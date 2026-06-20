import { Controller, Get, Post, Body, Param, NotFoundException, BadRequestException, Logger } from "@nestjs/common";
import { TemplateSchema } from "@template-ai/contracts";
import { TemplatesService } from "./templates.service";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import type { CreateTemplateData, TemplateResponse } from "./templates.service";

// Build the creation schema: omit server-generated fields and status (backend
// defaults to "draft" when not provided — see controller create() method).
const CreateTemplateBody = TemplateSchema.omit({ id: true, createdAt: true, status: true });

@Controller("templates")
export class TemplatesController {
  private readonly logger = new Logger(TemplatesController.name);

  public constructor(
    private readonly templatesService: TemplatesService,
    private readonly postgres: PostgresService,
  ) {}

  /**
   * GET /templates — list all templates for the current user.
   */
  @Get()
  public async findAll(): Promise<TemplateResponse[]> {
    return this.templatesService.list(0);
  }

  /**
   * GET /templates/:id — return a single template by id.
   */
  @Get(":id")
  public async findOne(@Param("id") id: string): Promise<TemplateResponse> {
    const template = await this.templatesService.findOne(0, id);

    if (!template) {
      throw new NotFoundException(`Template with id "${id}" not found`);
    }

    return template;
  }

  /**
   * GET /templates/:id/extracted-text — return the extracted text from the
   * template's associated document analysis results.
   */
  @Get(":id/extracted-text")
  public async getExtractedText(
    @Param("id") id: string,
  ): Promise<{ extractedText: string | null }> {
    const template = await this.templatesService.findOne(0, id);

    return this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const result = await client.query(
        `SELECT extracted_text FROM analysis_results WHERE document_id = $1`,
        [template.documentId],
      );

      if (result.rowCount === 0 || result.rows.length === 0) {
        return { extractedText: null };
      }

      return {
        extractedText: (result.rows[0].extracted_text as string) ?? null,
      };
    });
  }

  /**
   * POST /templates — create a new template.
   * Validates the request body using Zod before delegating to the service.
   */
  @Post()
  public async create(@Body() body: unknown): Promise<TemplateResponse> {
    // Debug: log what body the controller actually receives
    this.logger.debug(
      `POST /api/templates body type=${typeof body}, isNull=${body === null}, isArray=${Array.isArray(body)}`,
    );

    if (body === null || body === undefined || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException(
        "El cuerpo de la solicitud está vacío o no es un objeto JSON válido. Verificá que estés enviando los datos del formulario.",
      );
    }

    // Normalize: Zod v4 .optional() rejects null — convert null → undefined.
    const raw = body as Record<string, unknown>;
    if (Array.isArray(raw.entities)) {
      raw.entities = (raw.entities as Record<string, unknown>[]).map((e) => ({
        ...e,
        sourceSpan: e.sourceSpan ?? undefined,
      }));
    }

    const parsed = CreateTemplateBody.safeParse(raw);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      // Map Zod error paths to user-friendly Spanish messages
      const path = firstError.path.join(".");
      const zodMessage = firstError.message;
      this.logger.warn(`Template validation failed: path=${path}, message=${zodMessage}`);
      throw new BadRequestException(
        `Error de validación${path ? ` en "${path}"` : ""}: ${zodMessage}`,
      );
    }

    const data: CreateTemplateData = {
      name: parsed.data.name,
      description: parsed.data.description,
      documentId: parsed.data.documentId,
      entities: parsed.data.entities,
      category: parsed.data.category,
      status: "draft",
    };

    return this.templatesService.create(data);
  }
}