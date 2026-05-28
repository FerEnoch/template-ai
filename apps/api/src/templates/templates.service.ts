import { Injectable, ConflictException } from "@nestjs/common";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { TemplatesRepository } from "../infrastructure/postgres/repositories/templates.repository";
import type { CreateTemplateInput } from "../infrastructure/postgres/repositories/templates.repository";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface TemplateResponse {
  id: string;
  name: string;
  description: string;
  documentId: string;
  entities: unknown[];
  category: string;
  status: string;
  createdAt: string;
}

export interface CreateTemplateData {
  name: string;
  description?: string;
  documentId: string;
  entities: unknown[];
  category: string;
  status?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class TemplatesService {
  public constructor(private readonly postgres: PostgresService) {}

  /**
   * List all templates for the given userId.
   */
  async list(userId: number): Promise<TemplateResponse[]> {
    return this.postgres.withOwnerTransaction(userId, async ({ client }) => {
      const repo = new TemplatesRepository(client);
      const records = await repo.findByUserId(userId);
      return records.map(this.mapToResponse);
    });
  }

  /**
   * Create a new template.
   * Checks for duplicate name before inserting.
   * Throws ConflictException if a template with the same name already exists for this user.
   */
  async create(data: CreateTemplateData): Promise<TemplateResponse> {
    const userId = 0; // POC sentinel

    return this.postgres.withOwnerTransaction(userId, async ({ client }) => {
      const repo = new TemplatesRepository(client);

      // Uniqueness check
      const existing = await repo.findByNameAndUserId(data.name, userId);
      if (existing) {
        throw new ConflictException("A template with this name already exists");
      }

      const input: CreateTemplateInput = {
        userId,
        name: data.name,
        description: data.description ?? "",
        documentId: data.documentId,
        category: data.category,
        status: data.status,
        entities: data.entities,
      };

      const record = await repo.create(input);
      return this.mapToResponse(record);
    });
  }

  private mapToResponse(
    record: import("../infrastructure/postgres/repositories/templates.repository").TemplateRecord,
  ): TemplateResponse {
    return {
      id: record.id,
      name: record.name,
      description: record.description,
      documentId: record.documentId,
      entities: record.entities,
      category: record.category,
      status: record.status,
      createdAt: record.createdAt.toISOString(),
    };
  }
}