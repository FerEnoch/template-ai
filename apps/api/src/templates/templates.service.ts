import { Injectable, ConflictException, NotFoundException, Logger } from "@nestjs/common";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { TemplatesRepository } from "../infrastructure/postgres/repositories/templates.repository";
import { DocumentsRepository } from "../infrastructure/postgres/repositories/documents.repository";
import { CasesRepository } from "../infrastructure/postgres/repositories/cases.repository";
import type { CreateTemplateInput } from "../infrastructure/postgres/repositories/templates.repository";
import { unlink as fsUnlink } from "fs/promises";

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

/** Parse a boolean query parameter: "true" or "1" → true; everything else → false. */
function parseBool(value?: string | boolean): boolean {
  if (typeof value === "boolean") return value;
  return value === "true" || value === "1";
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface TemplateResponse {
  id: string;
  name: string;
  description: string;
  documentId: string | null;
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
  private readonly logger = new Logger(TemplatesService.name);

  public constructor(private readonly postgres: PostgresService) {}

  /**
   * List all templates for the given userId.
   * By default archived (soft-deleted) templates are excluded.
   */
  async list(userId: number, includeArchived = false): Promise<TemplateResponse[]> {
    return this.postgres.withOwnerTransaction(userId, async ({ client }) => {
      const repo = new TemplatesRepository(client);
      const records = await repo.findByUserId(userId, includeArchived);
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
          throw new ConflictException(
            `Ya existe una plantilla llamada "${data.name}". Elegí otro nombre.`,
          );
        }
        throw error;
      }
    });
  }

  /**
   * Soft-delete a template and optionally cascade to its source document
   * and generated cases.
   *
   * Idempotent: calling delete on an already archived template returns
   * without error. Throws NotFoundException if the template does not exist.
   */
  async delete(
    userId: number,
    id: string,
    options: {
      deleteSourceFile?: boolean | string;
      deleteGeneratedCases?: boolean | string;
    } = {},
  ): Promise<void> {
    const deleteSourceFile = parseBool(options.deleteSourceFile);
    const deleteGeneratedCases = parseBool(options.deleteGeneratedCases);

    await this.postgres.withOwnerTransaction(userId, async ({ client }) => {
      const templatesRepo = new TemplatesRepository(client);
      const documentsRepo = new DocumentsRepository(client);
      const casesRepo = new CasesRepository(client);

      const archived = await templatesRepo.softDelete(id);

      if (!archived) {
        // Either already archived or does not exist. Distinguish so we
        // remain idempotent for archived templates but 404 for missing ones.
        const existing = await templatesRepo.findById(id);
        if (!existing) {
          throw new NotFoundException(`Template with id "${id}" not found`);
        }
        return;
      }

      if (deleteGeneratedCases) {
        try {
          await casesRepo.archiveByTemplateId(id);
        } catch (error: unknown) {
          this.logger.warn(
            `Failed to archive cases for template ${id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      if (deleteSourceFile && archived.documentId) {
        const document = await documentsRepo.findById(archived.documentId);
        if (document) {
          if (document.filePath) {
            await this.unlinkFile(document.filePath);
          }
          await documentsRepo.delete(document.id);
        }
      }
    });
  }

  private async unlinkFile(filePath: string): Promise<void> {
    try {
      await fsUnlink(filePath);
    } catch (error: unknown) {
      // ENOENT means the file is already gone — treat as success.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as Record<string, unknown>).code === "ENOENT"
      ) {
        return;
      }
      // Other filesystem errors (EACCES, EBUSY, EIO) — log but don't
      // abort the transaction. The template MUST still be archived per spec.
      this.logger.warn(
        `Failed to unlink source file "${filePath}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
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
