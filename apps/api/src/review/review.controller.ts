import { Controller, Post, Param, Body, NotFoundException } from "@nestjs/common";
import { ReviewService, ReviewEntity, UpdateEntityInput } from "./review.service";

@Controller("review")
export class ReviewController {
  public constructor(private readonly reviewService: ReviewService) {}

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
}