import {
  Injectable,
  HttpException,
  NotFoundException,
  ConflictException,
  BadGatewayException,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { CasesRepository } from "../infrastructure/postgres/repositories/cases.repository";
import { DocumentGenerationService } from "../ai/document-generation.service.js";
import type { CaseRecord } from "../infrastructure/postgres/repositories/cases.repository";
import type { TemplateResponse } from "../templates/templates.service";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface CaseResponse {
  id: string;
  userId: number;
  templateId: string;
  status: string;
  name: string | null;
  formData: Record<string, string>;
  generatedText: string | null;
  createdAt: string;
  updatedAt: string;
  template: TemplateResponse;
}

export interface CreateCaseData {
  templateId: string;
}

export interface UpdateCaseData {
  formData?: Record<string, string>;
  status?: string;
  name?: string | null;
}

/**
 * Detect a PostgreSQL unique-violation error (SQLSTATE 23505), raised by the
 * partial UNIQUE (user_id, name) index on casos when renaming a case to a
 * name another case of the same user already owns.
 */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as Record<string, unknown>).code === "23505"
  );
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  public constructor(
    private readonly postgres: PostgresService,
    private readonly generationService: DocumentGenerationService,
  ) {}

  /**
   * Create a new case from a template.
   * Validates the template exists before inserting.
   * If a borrador for the same (user, template) already exists, returns it
   * without inserting a new row.
   *
   * The partial unique index on (user_id, template_id) WHERE status='borrador'
   * makes the INSERT race-safe: if a concurrent request creates the borrador
   * first, we catch the unique violation and return the existing row.
   */
  async create(
    userId: number,
    data: CreateCaseData,
  ): Promise<{ case: CaseResponse; created: boolean }> {
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

      // Idempotency: reuse an existing borrador for this (user, template).
      const existing = await repo.findBorradorByUserAndTemplate(
        userId,
        data.templateId,
      );
      if (existing) {
        return { case: this.mapToResponse(existing), created: false };
      }

      let record;
      try {
        record = await repo.create({
          userId,
          templateId: data.templateId,
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          // Another concurrent request created the borrador first.
          // Re-fetch and return the existing row so callers remain idempotent.
          const existingAfterRace = await repo.findBorradorByUserAndTemplate(
            userId,
            data.templateId,
          );
          if (existingAfterRace) {
            return {
              case: this.mapToResponse(existingAfterRace),
              created: false,
            };
          }
        }

        this.logger.error(
          `Failed to create case for template ${data.templateId} (user ${userId}): ${error instanceof Error ? error.message : String(error)}`,
          error instanceof Error ? error.stack : undefined,
        );
        throw new InternalServerErrorException(
          "No se pudo crear el caso. Intentá nuevamente.",
        );
      }

      return { case: this.mapToResponse(record), created: true };
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
   * Only archivado cases are read-only. generado cases can be edited to allow re-generation.
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

      if (existing.status === "archivado") {
        throw new ConflictException(
          `Case "${id}" is archived. Cannot update form data.`,
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
   * Rename a case. Pass `null` to clear the custom name and fall back to
   * the template name on the client.
   */
  async updateName(
    userId: number,
    id: string,
    name: string | null,
  ): Promise<CaseResponse> {
    return this.postgres.withOwnerTransaction(userId, async ({ client }) => {
      const repo = new CasesRepository(client);
      const existing = await repo.findById(id);

      if (!existing) {
        throw new NotFoundException(`Case with id "${id}" not found`);
      }

      try {
        const updated = await repo.updateName(id, name);

        if (!updated) {
          throw new NotFoundException(`Case with id "${id}" not found`);
        }

        return this.mapToResponse(updated);
      } catch (error: unknown) {
        if (isUniqueViolation(error)) {
          throw new ConflictException(
            `Ya existe un documento llamado "${name}". Elegí otro nombre.`,
          );
        }
        throw error;
      }
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
        // Distinguish: missing row vs stale write (case was archived/deleted during AI call)
        const current = await repo.findById(id);
        if (!current) {
          throw new NotFoundException(`Case with id "${id}" not found`);
        }
        throw new ConflictException(
          `Case status changed during generation (now: ${current.status})`,
        );
      }

      return this.mapToResponse(updated);
    });
  }

  /**
   * Orchestrate AI document generation for a case:
   * 1. Fetch the case + validate status (short read transaction)
   * 2. Fetch base extracted text from the template's source document
   * 3. Call DocumentGenerationService — OUTSIDE any transaction
   * 4. Persist generated text and set status to 'generado' (short write transaction)
   *
   * The AI call is intentionally kept outside the DB transaction. OpenRouter
   * inference can take 30-60s (plus retries), and holding a connection/lock
   * open that long caused request timeouts (ECONNRESET) and process crashes
   * (ECONNREFUSED) when the HTTP layer aborted the socket.
   */
  async generate(userId: number, id: string): Promise<CaseResponse> {
    this.logger.log(`Starting generation for case ${id} (user ${userId})`);

    try {
      // --- Read phase: fetch case + template data in a short-lived transaction ---
      const { caseRecord, baseText } = await this.postgres.withOwnerTransaction(
        userId,
        async ({ client }) => {
          const repo = new CasesRepository(client);
          const record = await repo.findById(id);

          if (!record) {
            throw new NotFoundException(`Case with id "${id}" not found`);
          }

          if (record.status === "archivado") {
            throw new ConflictException(
              `Case "${id}" is archived and cannot be regenerated.`,
            );
          }

          if (!record.template) {
            throw new NotFoundException(`Template for case "${id}" not found`);
          }

          // Fetch base extracted text from the template's source document
          let text: string | null = null;
          if (record.template.documentId) {
            const txtResult = await client.query(
              `SELECT extracted_text FROM analysis_results WHERE document_id = $1`,
              [record.template.documentId],
            );
            text = (txtResult.rows[0]?.extracted_text as string) ?? null;
          }

          this.logger.log(`Read phase done: case ${id}, status=${record.status}, entities=${(record.template?.entities as unknown[] | undefined)?.length ?? 0}, hasBaseText=${text !== null}`);

          return {
            caseRecord: record,
            baseText: text,
          };
        },
      );

      // --- AI generation phase: runs OUTSIDE any DB transaction ---
      this.logger.log(`Calling AI generation for case ${id}...`);
      const genResult = await this.generationService.generate({
        entities: (caseRecord.template?.entities as Array<{
          id: string;
          label: string;
          value: string;
          group: string;
        }>) ?? [],
        formData: caseRecord.formData,
        baseText,
      });

      if (!genResult.success) {
        this.logger.error(
          `Generation failed for case ${id}: ${genResult.error} (${genResult.errorType})`,
        );
        throw new BadGatewayException({
          message:
            "No se pudo contactar al servicio de IA. Intentá nuevamente.",
          errorType: genResult.errorType ?? "UNKNOWN",
        });
      }

      this.logger.log(`AI generation succeeded for case ${id}`);

      // --- Write phase: persist generated text in a short-lived transaction ---
      const generatedText = genResult.generatedText ?? "";
      const result = await this.setGeneratedText(userId, id, generatedText);
      this.logger.log(`Generation complete for case ${id}`);
      return result;
    } catch (error) {
      // HttpExceptions (NotFound, Conflict, BadGateway) are re-thrown as-is
      // so the exception filter returns the correct status code + message.
      if (error instanceof HttpException) {
        throw error;
      }

      // Unexpected error — log with full stack and throw a user-friendly 500.
      this.logger.error(
        `Unexpected error generating case ${id}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException(
        "No se pudo generar el documento. Intentá nuevamente.",
      );
    }
  }

  private mapToResponse(record: CaseRecord): CaseResponse {
    if (!record.template) {
      throw new NotFoundException(`Template for case "${record.id}" not found`);
    }

    return {
      id: record.id,
      userId: record.userId,
      templateId: record.templateId,
      status: record.status,
      name: record.name ?? null,
      formData: record.formData,
      generatedText: record.generatedText,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      template: {
        id: record.template.id,
        name: record.template.name,
        description: record.template.description,
        documentId: record.template.documentId,
        entities: record.template.entities,
        category: record.template.category,
        status: record.template.status,
        createdAt: record.template.createdAt.toISOString(),
      },
    };
  }
}
