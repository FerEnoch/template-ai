import { Controller, Get, Post, Body, Param, NotFoundException, BadRequestException } from "@nestjs/common";
import { TemplateSchema } from "@template-ai/contracts";
import { TemplatesService } from "./templates.service";
import type { CreateTemplateData, TemplateResponse } from "./templates.service";

// Build the creation schema by omitting server-generated fields
const CreateTemplateBody = TemplateSchema.omit({ id: true, createdAt: true });

@Controller("templates")
export class TemplatesController {
  public constructor(private readonly templatesService: TemplatesService) {}

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
   * POST /templates — create a new template.
   * Validates the request body using Zod before delegating to the service.
   */
  @Post()
  public async create(@Body() body: unknown): Promise<TemplateResponse> {
    const parsed = CreateTemplateBody.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      throw new BadRequestException(firstError?.message ?? "Validation error");
    }

    const data: CreateTemplateData = {
      name: parsed.data.name,
      description: parsed.data.description,
      documentId: parsed.data.documentId,
      entities: parsed.data.entities,
      category: parsed.data.category,
      status: parsed.data.status,
    };

    return this.templatesService.create(data);
  }
}