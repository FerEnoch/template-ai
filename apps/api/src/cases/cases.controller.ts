import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  BadRequestException,
  HttpCode,
  Logger,
} from "@nestjs/common";
import {
  CreateCaseRequestSchema,
  UpdateCaseFormDataSchema,
} from "@template-ai/contracts";
import { CasesService } from "./cases.service";
import type { CaseResponse } from "./cases.service";

@Controller("cases")
export class CasesController {
  private readonly logger = new Logger(CasesController.name);

  public constructor(private readonly casesService: CasesService) {}

  /**
   * GET /api/cases — list all cases for the current user.
   * Optional ?status= query param to filter by status.
   */
  @Get()
  public async findAll(
    @Query("status") status?: string,
  ): Promise<CaseResponse[]> {
    return this.casesService.list(0, status);
  }

  /**
   * GET /api/cases/:id — return a single case by id.
   */
  @Get(":id")
  public async findOne(@Param("id") id: string): Promise<CaseResponse> {
    return this.casesService.findOne(0, id);
  }

  /**
   * POST /api/cases — create a new case from a template.
   * Validates the request body with Zod.
   */
  @Post()
  @HttpCode(201)
  public async create(@Body() body: unknown): Promise<CaseResponse> {
    if (
      body === null ||
      body === undefined ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      throw new BadRequestException(
        "Request body must be a JSON object with a templateId field.",
      );
    }

    const parsed = CreateCaseRequestSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      const path = firstError.path.join(".");
      this.logger.warn(
        `Case creation validation failed: path=${path}, message=${firstError.message}`,
      );
      throw new BadRequestException(
        `Validation error${path ? ` in "${path}"` : ""}: ${firstError.message}`,
      );
    }

    return this.casesService.create(0, {
      templateId: parsed.data.templateId,
    });
  }

  /**
   * PATCH /api/cases/:id — update form data or status.
   * Validates the request body with Zod.
   */
  @Patch(":id")
  public async update(
    @Param("id") id: string,
    @Body() body: unknown,
  ): Promise<CaseResponse> {
    if (
      body === null ||
      body === undefined ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      throw new BadRequestException(
        "Request body must be a JSON object with formData and/or status.",
      );
    }

    const parsed = UpdateCaseFormDataSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      const path = firstError.path.join(".");
      this.logger.warn(
        `Case update validation failed: path=${path}, message=${firstError.message}`,
      );
      throw new BadRequestException(
        `Validation error${path ? ` in "${path}"` : ""}: ${firstError.message}`,
      );
    }

    // If only status is provided and it's 'archivado', archive the case
    if (parsed.data.status === "archivado" && !parsed.data.formData) {
      return this.casesService.archive(0, id);
    }

    return this.casesService.updateFormData(0, id, {
      formData: parsed.data.formData,
      status: parsed.data.status,
    });
  }

  /**
   * POST /api/cases/:id/generate — trigger AI document generation.
   * Orchestrates: fetch case + template entities + base text → call AI → update case.
   */
  @Post(":id/generate")
  public async generate(
    @Param("id") id: string,
  ): Promise<CaseResponse> {
    // For now, this is a placeholder that delegates to the service.
    // The full orchestration (fetching entities, base text, calling AI)
    // will be wired when the full generation flow is integrated.
    // For the PR scope, we validate the case exists and is in borrador status.
    const caseData = await this.casesService.findOne(0, id);

    if (caseData.status === "archivado") {
      throw new BadRequestException(
        `Case "${id}" is archived and cannot be regenerated.`,
      );
    }

    // Return the case — full generation orchestration is in Task 2.7 integration
    return caseData;
  }

  /**
   * DELETE /api/cases/:id — archive a case (soft delete).
   */
  @Delete(":id")
  public async archive(@Param("id") id: string): Promise<CaseResponse> {
    return this.casesService.archive(0, id);
  }
}
