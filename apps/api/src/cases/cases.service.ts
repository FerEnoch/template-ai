import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { CasesRepository } from "../infrastructure/postgres/repositories/cases.repository";
import type { CaseRecord } from "../infrastructure/postgres/repositories/cases.repository";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface CaseResponse {
  id: string;
  userId: number;
  templateId: string;
  status: string;
  formData: Record<string, string>;
  generatedText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCaseData {
  templateId: string;
}

export interface UpdateCaseData {
  formData?: Record<string, string>;
  status?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CasesService {
  public constructor(private readonly postgres: PostgresService) {}

  /**
   * Create a new case from a template.
   * Validates the template exists before inserting.
   */
  async create(userId: number, data: CreateCaseData): Promise<CaseResponse> {
    return this.postgres.withOwnerTransaction(userId, async ({ client }) => {
      // Verify template exists
      const tplResult = await client.query(
        `SELECT id FROM templates WHERE id = $1`,
        [data.templateId],
      );
      if (tplResult.rowCount === 0 || tplResult.rows.length === 0) {
        throw new NotFoundException(
          `Template with id "${data.templateId}" not found`,
        );
      }

      const repo = new CasesRepository(client);
      const record = await repo.create({
        userId,
        templateId: data.templateId,
      });

      return this.mapToResponse(record);
    });
  }

  /**
   * Find a single case by id.
   * Throws NotFoundException if not found (RLS returns null for cross-user).
   */
  async findOne(userId: number, id: string): Promise<CaseResponse> {
    return this.postgres.withOwnerTransaction(userId, async ({ client }) => {
      const repo = new CasesRepository(client);
      const record = await repo.findById(id);

      if (!record) {
        throw new NotFoundException(`Case with id "${id}" not found`);
      }

      return this.mapToResponse(record);
    });
  }

  /**
   * List all cases for the authenticated user, optionally filtered by status.
   * Archived cases are excluded by default.
   */
  async list(
    userId: number,
    statusFilter?: string,
  ): Promise<CaseResponse[]> {
    return this.postgres.withOwnerTransaction(userId, async ({ client }) => {
      const repo = new CasesRepository(client);
      const records = await repo.findByUserId(userId, statusFilter);
      return records.map(this.mapToResponse);
    });
  }

  /**
   * Update form data on a case.
   * Only borrador cases can be updated — generado/archivado are read-only (409).
   */
  async updateFormData(
    userId: number,
    id: string,
    data: UpdateCaseData,
  ): Promise<CaseResponse> {
    return this.postgres.withOwnerTransaction(userId, async ({ client }) => {
      const repo = new CasesRepository(client);
      const existing = await repo.findById(id);

      if (!existing) {
        throw new NotFoundException(`Case with id "${id}" not found`);
      }

      if (existing.status === "generado" || existing.status === "archivado") {
        throw new ConflictException(
          `Case "${id}" is locked (status: ${existing.status}). Cannot update form data.`,
        );
      }

      // Merge partial form data
      const mergedFormData = {
        ...existing.formData,
        ...(data.formData ?? {}),
      };

      const updated = await repo.updateFormData(id, mergedFormData);

      if (!updated) {
        throw new NotFoundException(`Case with id "${id}" not found`);
      }

      return this.mapToResponse(updated);
    });
  }

  /**
   * Archive a case by setting status to 'archivado'.
   */
  async archive(userId: number, id: string): Promise<CaseResponse> {
    return this.postgres.withOwnerTransaction(userId, async ({ client }) => {
      const repo = new CasesRepository(client);
      const existing = await repo.findById(id);

      if (!existing) {
        throw new NotFoundException(`Case with id "${id}" not found`);
      }

      const archived = await repo.updateStatus(id, "archivado");

      if (!archived) {
        throw new NotFoundException(`Case with id "${id}" not found`);
      }

      return this.mapToResponse(archived);
    });
  }

  /**
   * Update the generated text and set status to 'generado'.
   * Used by the generation orchestration flow.
   */
  async setGeneratedText(
    userId: number,
    id: string,
    generatedText: string,
  ): Promise<CaseResponse> {
    return this.postgres.withOwnerTransaction(userId, async ({ client }) => {
      const repo = new CasesRepository(client);
      const updated = await repo.updateGeneratedText(id, generatedText);

      if (!updated) {
        throw new NotFoundException(`Case with id "${id}" not found`);
      }

      return this.mapToResponse(updated);
    });
  }

  private mapToResponse(record: CaseRecord): CaseResponse {
    return {
      id: record.id,
      userId: record.userId,
      templateId: record.templateId,
      status: record.status,
      formData: record.formData,
      generatedText: record.generatedText,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
