import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadGatewayException,
  Logger,
} from "@nestjs/common";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { CasesRepository } from "../infrastructure/postgres/repositories/cases.repository";
import { DocumentGenerationService } from "../ai/document-generation.service.js";
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
  private readonly logger = new Logger(CasesService.name);

  public constructor(
    private readonly postgres: PostgresService,
    private readonly generationService: DocumentGenerationService,
  ) {}

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
   * 2. Fetch template entities + base extracted text (same read transaction)
   * 3. Call DocumentGenerationService — OUTSIDE any transaction
   * 4. Persist generated text and set status to 'generado' (short write transaction)
   *
   * The AI call is intentionally kept outside the DB transaction. OpenRouter
   * inference can take 30-60s (plus retries), and holding a connection/lock
   * open that long caused request timeouts (ECONNRESET) and process crashes
   * (ECONNREFUSED) when the HTTP layer aborted the socket.
   */
  async generate(userId: number, id: string): Promise<CaseResponse> {
    // --- Read phase: fetch case + template data in a short-lived transaction ---
    const { caseRecord, templateEntities, baseText } =
      await this.postgres.withOwnerTransaction(
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

          // Fetch template entities (from templates.entities JSONB)
          const tplResult = await client.query(
            `SELECT entities, document_id FROM templates WHERE id = $1`,
            [record.templateId],
          );
          const entities =
            (tplResult.rows[0]?.entities as Array<{
              id: string;
              label: string;
              value: string;
              group: string;
            }>) ?? [];

          // Fetch base extracted text from the template's source document
          let text: string | null = null;
          if (tplResult.rows[0]?.document_id) {
            const txtResult = await client.query(
              `SELECT extracted_text FROM analysis_results WHERE document_id = $1`,
              [tplResult.rows[0].document_id],
            );
            text = (txtResult.rows[0]?.extracted_text as string) ?? null;
          }

          return {
            caseRecord: record,
            templateEntities: entities,
            baseText: text,
          };
        },
      );

    // --- AI generation phase: runs OUTSIDE any DB transaction ---
    const genResult = await this.generationService.generate({
      entities: templateEntities,
      formData: caseRecord.formData,
      baseText,
    });

    if (!genResult.success) {
      this.logger.error(
        `Generation failed for case ${id}: ${genResult.error} (${genResult.errorType})`,
      );
      throw new BadGatewayException(
        "Document generation failed. Please try again.",
      );
    }

    // --- Write phase: persist generated text in a short-lived transaction ---
    const generatedText = genResult.generatedText ?? "";
    return this.setGeneratedText(userId, id, generatedText);
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
