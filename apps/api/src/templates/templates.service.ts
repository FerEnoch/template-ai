import { Injectable, ConflictException, NotFoundException } from "@nestjs/common";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { TemplatesRepository } from "../infrastructure/postgres/repositories/templates.repository";
import type { CreateTemplateInput } from "../infrastructure/postgres/repositories/templates.repository";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Detect PostgreSQL unique violation (error code 23505). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as Record<string, unknown>).code === "23505"
  );
}

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
   * Find a single template by id for the given userId.
   * Throws NotFoundException if not found.
   */
  async findOne(userId: number, id: string): Promise<TemplateResponse> {
    return this.postgres.withOwnerTransaction(userId, async ({ client }) => {
      const repo = new TemplatesRepository(client);
      const record = await repo.findById(id);

      if (!record) {
        throw new NotFoundException(`Template with id "${id}" not found`);
      }

      return this.mapToResponse(record);
    });
  }

  /**
   * Create a new template.
   * Relies on the UNIQUE (user_id, name) constraint in PostgreSQL to detect
   * duplicates. Catches unique violation (code 23505) and throws ConflictException.
   * This avoids the TOCTOU race of a SELECT-then-INSERT pattern.
   */
  async create(data: CreateTemplateData): Promise<TemplateResponse> {
    const userId = 0; // POC sentinel

    return this.postgres.withOwnerTransaction(userId, async ({ client }) => {
      const repo = new TemplatesRepository(client);

      const input: CreateTemplateInput = {
        userId,
        name: data.name,
        description: data.description ?? "",
        documentId: data.documentId,
        category: data.category,
        status: data.status,
        entities: data.entities,
      };

      try {
        const record = await repo.create(input);
        return this.mapToResponse(record);
      } catch (error: unknown) {
        if (isUniqueViolation(error)) {
          throw new ConflictException("A template with this name already exists");
        }
        throw error;
      }
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