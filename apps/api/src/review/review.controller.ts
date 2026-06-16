import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ClassifySpanRequestSchema } from "@template-ai/contracts";
import {
  ReviewService,
  ReviewEntity,
  UpdateEntityInput,
  ClassifySpanInput,
  CreateEntityInput,
  ManualEntityCount,
} from "./review.service";

@Controller("review")
export class ReviewController {
  public constructor(private readonly reviewService: ReviewService) {}

  /**
   * POST /:documentId/entities/classify-span
   * Classify a text span via AI and persist the resulting entity.
   * MUST be registered before :entityId to avoid route collision.
   */
  @Post(":documentId/entities/classify-span")
  public async classifySpan(
    @Param("documentId") documentId: string,
    @Body() body: unknown,
  ): Promise<{ label: string; group: string; value: string }> {
    // Validate request body with Zod schema
    const parsed = ClassifySpanRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(
        parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", "),
      );
    }

    const input: ClassifySpanInput = {
      text: parsed.data.text,
      sourceSpan: parsed.data.sourceSpan,
      context: parsed.data.context,
    };

    return this.reviewService.classifySpan(documentId, input);
  }

  /**
   * POST /:documentId/entities/:entityId
   * Update an entity's review fields (reviewed, value, excluded).
   */
  @Post(":documentId/entities/:entityId")
  public async updateEntity(
    @Param("documentId") documentId: string,
    @Param("entityId") entityId: string,
    @Body() body: UpdateEntityInput,
  ): Promise<ReviewEntity> {
    return this.reviewService.updateEntity(documentId, entityId, body);
  }

  /**
   * POST /:documentId/entities
   * Create a manual entity directly (user-confirmed after classification).
   */
  @Post(":documentId/entities")
  public async createEntity(
    @Param("documentId") documentId: string,
    @Body() body: CreateEntityInput,
  ): Promise<{ entity: ReviewEntity }> {
    if (!body.label || !body.value || !body.group) {
      throw new BadRequestException("label, value, and group are required");
    }

    const entity = await this.reviewService.createEntity(documentId, body);

    return { entity };
  }

  /**
   * GET /:documentId/entities/manual-count
   * Returns the count of manual entities and whether more can be added.
   */
  @Get(":documentId/entities/manual-count")
  public async getManualEntityCount(
    @Param("documentId") documentId: string,
  ): Promise<ManualEntityCount> {
    return this.reviewService.countManualEntities(documentId);
  }
}
