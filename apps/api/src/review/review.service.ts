import { Injectable, NotFoundException } from "@nestjs/common";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { EntitiesRepository } from "../infrastructure/postgres/repositories/entities.repository";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface ReviewEntity {
  id: string;
  documentId: string;
  label: string;
  value: string;
  group: string;
  confidence: string;
  sourceSpan: { start: number; end: number } | null;
  reviewed: boolean;
  excluded: boolean;
}

export interface UpdateEntityInput {
  reviewed?: boolean;
  value?: string;
  excluded?: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class ReviewService {
  public constructor(private readonly postgres: PostgresService) {}

  /**
   * Update an entity's review fields (reviewed, value, excluded).
   * Finds the entity by ID, applies a partial update, and returns the updated entity.
   * Throws NotFoundException if the entity doesn't exist.
   */
  async updateEntity(
    documentId: string,
    entityId: string,
    update: UpdateEntityInput,
  ): Promise<ReviewEntity> {
    return this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const entitiesRepo = new EntitiesRepository(client);

      // Find the entity by ID
      const entity = await entitiesRepo.findById(entityId);

      if (!entity) {
        throw new NotFoundException("Entity not found");
      }

      // Validate that the entity belongs to the specified document
      if (entity.documentId !== documentId) {
        throw new NotFoundException("Entity not found");
      }

      // Merge partial update fields
      const mergedFields: import("../infrastructure/postgres/repositories/entities.repository").UpdateEntityInput = {};

      if (update.reviewed !== undefined) {
        mergedFields.reviewed = update.reviewed;
      }
      if (update.value !== undefined) {
        mergedFields.value = update.value;
      }
      if (update.excluded !== undefined) {
        mergedFields.excluded = update.excluded;
      }

      // Save the merged update
      const updated = await entitiesRepo.update(entityId, mergedFields);

      if (!updated) {
        throw new NotFoundException("Entity not found after update");
      }

      return this.mapToReviewEntity(updated);
    });
  }

  private mapToReviewEntity(
    record: import("../infrastructure/postgres/repositories/entities.repository").EntityRecord,
  ): ReviewEntity {
    return {
      id: record.id,
      documentId: record.documentId,
      label: record.label,
      value: record.value,
      group: record.group,
      confidence: record.confidence,
      sourceSpan: record.sourceSpan,
      reviewed: record.reviewed,
      excluded: record.excluded,
    };
  }
}