import { Injectable, NotFoundException, ForbiddenException, Logger } from "@nestjs/common";
import { MANUAL_ENTITY_LIMIT } from "@template-ai/contracts";
import { OpenRouterService, OpenRouterError } from "../ai/open-router.service";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { EntitiesRepository } from "../infrastructure/postgres/repositories/entities.repository";
import { AnalysisResultsRepository } from "../infrastructure/postgres/repositories/analysis-results.repository";

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

export interface ClassifySpanInput {
  text: string;
  sourceSpan: { start: number; end: number };
  context: string;
}

export interface CreateEntityInput {
  id?: string;
  label: string;
  value: string;
  group: string;
  confidence?: string;
  sourceSpan?: { start: number; end: number };
}

export interface ManualEntityCount {
  count: number;
  limit: number;
  canAddMore: boolean;
}

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
  userCreated: boolean;
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
  private readonly logger = new Logger(ReviewService.name);

  public constructor(
    private readonly postgres: PostgresService,
    private readonly openRouter: OpenRouterService,
  ) {}

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

  /**
   * Classify a text span via AI and return the inferred entity fields.
   * Does NOT persist the entity — the caller must use createEntity() to save.
   * Enforces the manual entity cap before calling AI.
   */
  async classifySpan(
    documentId: string,
    input: ClassifySpanInput,
  ): Promise<{ label: string; group: string; value: string }> {
    return this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const entitiesRepo = new EntitiesRepository(client);

      // Enforce manual entity cap
      await this.enforceManualEntityLimit(entitiesRepo, documentId);

      // Call AI to classify the span (with retry)
      return this.callClassifyWithRetry(input.text, input.context);
    });
  }

  /**
   * Create a manual entity directly (user confirms after classification).
   * Enforces the manual entity cap.
   */
  async createEntity(
    documentId: string,
    input: CreateEntityInput,
  ): Promise<ReviewEntity> {
    return this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const entitiesRepo = new EntitiesRepository(client);
      const analysisRepo = new AnalysisResultsRepository(client);

      // Resolve the actual analysis result from the document
      const results = await analysisRepo.findByDocumentId(documentId);
      if (results.length === 0) {
        throw new NotFoundException("No analysis result found for this document");
      }
      const analysisResultId = results[0].id;

      // Enforce manual entity cap
      await this.enforceManualEntityLimit(entitiesRepo, documentId);

      const created = await entitiesRepo.create({
        analysisResultId,
        documentId,
        label: input.label,
        value: input.value,
        group: input.group,
        confidence: input.confidence ?? "ALTA",
        sourceSpan: input.sourceSpan,
        userCreated: true,
      });

      return this.mapToReviewEntity(created);
    });
  }

  /**
   * Count manual (user-created) entities for a document.
   */
  async countManualEntities(documentId: string): Promise<ManualEntityCount> {
    return this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const entitiesRepo = new EntitiesRepository(client);
      const count = await entitiesRepo.countUserCreated(documentId);

      return {
        count,
        limit: MANUAL_ENTITY_LIMIT,
        canAddMore: count < MANUAL_ENTITY_LIMIT,
      };
    });
  }

  /**
   * Enforce the manual entity limit. Throws ForbiddenException if cap is reached.
   */
  private async enforceManualEntityLimit(
    entitiesRepo: EntitiesRepository,
    documentId: string,
  ): Promise<void> {
    const count = await entitiesRepo.countUserCreated(documentId);
    if (count >= MANUAL_ENTITY_LIMIT) {
      throw new ForbiddenException("MANUAL_ENTITY_LIMIT_REACHED");
    }
  }

  /**
   * Call AI classifySpan with one retry on timeout/network error.
   * Also handles malformed JSON by stripping markdown fences.
   */
  private async callClassifyWithRetry(
    text: string,
    context: string,
  ): Promise<{ label: string; group: string; value: string }> {
    try {
      return await this.openRouter.classifySpan(text, context);
    } catch (error) {
      if (error instanceof OpenRouterError) {
        // Retry once on NETWORK_ERROR, API_ERROR, or INVALID_RESPONSE (transient / malformed-output retry)
        if (error.code === "NETWORK_ERROR" || error.code === "API_ERROR" || error.code === "INVALID_RESPONSE") {
          this.logger.warn(
            `classifySpan failed (${error.code}), retrying once...`,
          );
          try {
            return await this.openRouter.classifySpan(text, context);
          } catch (retryError) {
            if (retryError instanceof OpenRouterError) {
              throw retryError;
            }
            throw new OpenRouterError(
              `classifySpan retry failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
              "CLASSIFICATION_FAILED",
            );
          }
        }
      }
      throw error;
    }
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
      userCreated: record.userCreated,
    };
  }
}