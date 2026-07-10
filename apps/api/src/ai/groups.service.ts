import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PostgresService } from "../infrastructure/postgres/postgres.service.js";
import { EntitiesRepository } from "../infrastructure/postgres/repositories/entities.repository.js";
import { TemplatesRepository } from "../infrastructure/postgres/repositories/templates.repository.js";
import { AnalysisResultsRepository } from "../infrastructure/postgres/repositories/analysis-results.repository.js";

/**
 * Canonical seed groups. Every extraction prompt includes these categories.
 * GENERAL is the catch-all for unclassifiable entities; OTROS is the
 * user-facing alias for the same bucket.
 */
export const SEED_GROUPS = [
  "PARTES",
  "INMUEBLE",
  "FECHAS",
  "ANEXOS",
  "GENERAL",
  "OTROS",
] as const;

const GROUP_NAME_REGEX = /^[A-Z0-9/]{2,30}$/;

function isValidGroupName(group: string): boolean {
  return GROUP_NAME_REGEX.test(group);
}

/**
 * Manages dynamic entity groups: model-suggested categories that a user can
 * approve or reject inline. Approved groups join the seed set for subsequent
 * extractions; rejected groups have their entities reassigned to GENERAL.
 */
@Injectable()
export class GroupsService {
  private readonly logger = new Logger(GroupsService.name);

  constructor(private readonly postgres: PostgresService) {}

  /**
   * Resolves the full group list for an extraction prompt.
   *
   * Always returns the seed groups. When a templateId is provided, approved
   * dynamic groups from the template's `suggestedGroupsStatus` map are appended.
   * Invalid or non-approved statuses are ignored.
   */
  async resolve(templateId?: string): Promise<string[]> {
    const groups = [...SEED_GROUPS];

    if (!templateId) {
      return groups;
    }

    return this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const templatesRepo = new TemplatesRepository(client);
      const template = await templatesRepo.findById(templateId);

      if (!template) {
        return groups;
      }

      for (const [group, status] of Object.entries(template.suggestedGroupsStatus)) {
        if (status !== "approved") {
          continue;
        }

        if (!isValidGroupName(group)) {
          this.logger.warn(`Invalid dynamic group name "${group}" ignored in resolve.`);
          continue;
        }

        if (!groups.includes(group)) {
          groups.push(group);
        }
      }

      return groups;
    });
  }

  /**
   * Approve a suggested group. It will be included in future extraction prompts.
   */
  async approve(templateId: string, group: string): Promise<void> {
    if (!isValidGroupName(group)) {
      this.logger.warn(`Invalid dynamic group name "${group}" rejected in approve.`);
      return;
    }

    await this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const templatesRepo = new TemplatesRepository(client);
      const template = await templatesRepo.findById(templateId);

      if (!template) {
        throw new NotFoundException(`Template with id "${templateId}" not found`);
      }

      const nextStatus = { ...template.suggestedGroupsStatus, [group]: "approved" };
      await templatesRepo.updateSuggestedGroups(templateId, nextStatus);
    });
  }

  /**
   * Reject a suggested group. The status is persisted as rejected and any
   * entities already assigned to that group are reassigned to GENERAL.
   */
  async reject(templateId: string, group: string): Promise<void> {
    if (!isValidGroupName(group)) {
      this.logger.warn(`Invalid dynamic group name "${group}" rejected in reject.`);
      return;
    }

    await this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const templatesRepo = new TemplatesRepository(client);
      const template = await templatesRepo.findById(templateId);

      if (!template) {
        throw new NotFoundException(`Template with id "${templateId}" not found`);
      }

      const nextStatus = { ...template.suggestedGroupsStatus, [group]: "rejected" };
      await templatesRepo.updateSuggestedGroups(templateId, nextStatus);

      if (template.documentId) {
        await this.reassignGroupToGeneral(client, template.documentId, group);
      }
    });
  }

  /**
   * Reassign all entities with the rejected group to GENERAL for every
   * analysis result tied to the template's document.
   */
  private async reassignGroupToGeneral(
    client: import("pg").PoolClient,
    documentId: string,
    group: string,
  ): Promise<void> {
    const analysisRepo = new AnalysisResultsRepository(client);
    const entitiesRepo = new EntitiesRepository(client);

    const analysisResults = await analysisRepo.findByDocumentId(documentId);

    for (const analysisResult of analysisResults) {
      const entities = await entitiesRepo.findByAnalysisResultId(analysisResult.id);

      for (const entity of entities) {
        if (entity.group === group) {
          await entitiesRepo.update(entity.id, { group: "GENERAL" });
        }
      }
    }
  }
}
