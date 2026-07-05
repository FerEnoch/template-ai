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
  Logger,
  Res,
  HttpCode,
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
   * Returns 201 when a new row is created, 200 when an existing borrador is reused.
   */
  @Post()
  public async create(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: any,
  ): Promise<CaseResponse> {
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

    const { case: caseResponse, created } = await this.casesService.create(0, {
      templateId: parsed.data.templateId,
    });

    res.status(created ? 201 : 200);
    return caseResponse;
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

    let result: CaseResponse | undefined;

    // Always rename first when a name is provided so it is not silently
    // dropped when combined with formData or status updates.
    if (parsed.data.name !== undefined) {
      result = await this.casesService.updateName(0, id, parsed.data.name);
    }

    // If only status is provided and it's 'archivado', archive the case
    if (parsed.data.status === "archivado" && !parsed.data.formData) {
      result = await this.casesService.archive(0, id);
    } else if (parsed.data.formData !== undefined || parsed.data.status !== undefined) {
      result = await this.casesService.updateFormData(0, id, {
        formData: parsed.data.formData,
        status: parsed.data.status,
      });
    }

    return result ?? (await this.casesService.findOne(0, id));
  }

  /**
   * POST /api/cases/:id/generate — trigger AI document generation.
   * Orchestrates: fetch case + template entities + base text → call AI → update case.
   * Blocks regeneration if the case is archived.
   */
  @Post(":id/generate")
  public async generate(
    @Param("id") id: string,
  ): Promise<CaseResponse> {
    return this.casesService.generate(0, id);
  }

  /**
   * DELETE /api/cases/:id — archive a case (soft delete).
   */
  @Delete(":id")
  @HttpCode(204)
  public async archive(@Param("id") id: string): Promise<void> {
    await this.casesService.archive(0, id);
  }
}
