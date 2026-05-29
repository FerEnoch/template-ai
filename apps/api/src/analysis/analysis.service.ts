import { Injectable, NotFoundException } from "@nestjs/common";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { AnalysisResultsRepository } from "../infrastructure/postgres/repositories/analysis-results.repository";
import { EntitiesRepository } from "../infrastructure/postgres/repositories/entities.repository";
import { DocumentsRepository } from "../infrastructure/postgres/repositories/documents.repository";
import { DocumentAnalysisService } from "../ai/document-analysis.service.js";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface AnalysisResult {
  documentId: string;
  status: string;
  progress: number;
  startedAt: string;
  completedAt: string | null;
  entities: AnalysisEntity[];
}

export interface AnalysisEntity {
  id: string;
  label: string;
  value: string;
  group: string;
  confidence: string;
  sourceSpan: { start: number; end: number } | null;
  reviewed: boolean;
  excluded: boolean;
}

export interface AnalysisStatus {
  documentId: string;
  status: string;
  progress: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AnalysisService {
  public constructor(
    private readonly postgres: PostgresService,
    private readonly documentAnalysisService: DocumentAnalysisService,
  ) {}

  /**
   * GET /:id — Returns the full analysis result, including entities.
   * On each call while "processing", increments progress by 25.
   * When progress reaches 100, calls AI for entity extraction and marks as "completed".
   * Once "completed", returns idempotently without re-inserting entities.
   */
  async getFullResult(documentId: string): Promise<AnalysisResult> {
    return this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const analysisRepo = new AnalysisResultsRepository(client);

      // Find the analysis result by documentId
      const results = await analysisRepo.findByDocumentId(documentId);

      if (results.length === 0) {
        throw new NotFoundException("Analysis result not found");
      }

      const result = results[0];

      // If already completed, return as-is (idempotent)
      if (result.status === "completed") {
        const entitiesRepo = new EntitiesRepository(client);
        const entities = await entitiesRepo.findByAnalysisResultId(result.id);

        return this.mapToAnalysisResult(result, entities);
      }

      // Permanent failure: retries exhausted
      if (result.status === "failed" && result.retryCount >= 3) {
        return this.mapToAnalysisResult(result, []);
      }

      // Pending status — return without incrementing progress
      if (result.status === "pending") {
        return this.mapToAnalysisResult(result, []);
      }

      // Processing path: increment progress
      const incremented = await analysisRepo.incrementProgress(result.id);

      if (!incremented) {
        throw new NotFoundException("Analysis result not found after increment");
      }

      // Check if we've reached 100% — if so, call AI for entity extraction
      if (incremented.progress >= 100) {
        // Fetch the document to get the file path
        const documentsRepo = new DocumentsRepository(client);
        const document = await documentsRepo.findById(documentId);

        if (!document) {
          throw new NotFoundException("Document not found");
        }

        // Call AI extraction (pure logic — no DB writes)
        const analysisResult = await this.documentAnalysisService.analyze(
          document.filePath,
        );

        if (!analysisResult.success) {
          // AI failed — increment retry count and mark as failed
          await analysisRepo.incrementRetryCount(result.id, analysisResult.error ?? "Unknown error");
          const failed = await analysisRepo.updateStatus(result.id, "failed");

          if (!failed) {
            throw new NotFoundException("Analysis result not found after status update");
          }

          return this.mapToAnalysisResult(failed, []);
        }

        // AI succeeded — insert entities
        const entitiesRepo = new EntitiesRepository(client);
        const entityInputs = (analysisResult.entities ?? []).map((e) => ({
          analysisResultId: result.id,
          documentId,
          label: e.label,
          value: e.value,
          group: e.group,
          confidence: e.confidence,
          sourceSpan: e.sourceSpan,
        }));

        if (entityInputs.length > 0) {
          await entitiesRepo.bulkInsert(entityInputs);
        }

        const insertedEntities = await entitiesRepo.findByAnalysisResultId(result.id);
        const completed = await analysisRepo.updateStatus(result.id, "completed");

        if (!completed) {
          throw new NotFoundException("Analysis result not found after status update");
        }

        return this.mapToAnalysisResult(completed, insertedEntities);
      }

      // Still processing — return incremented result with empty entities
      return this.mapToAnalysisResult(incremented, []);
    });
  }

  /**
   * GET /:id/status — Lightweight endpoint returning only documentId, status, progress.
   * Also drives progress: increments on each poll, transitions to "completed" at 100.
   * This matches the MSW contract where /status also drives progress.
   */
  async getStatus(documentId: string): Promise<AnalysisStatus> {
    return this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const analysisRepo = new AnalysisResultsRepository(client);

      const results = await analysisRepo.findByDocumentId(documentId);

      if (results.length === 0) {
        throw new NotFoundException("Analysis result not found");
      }

      const result = results[0];

      // Terminal states: return immediately without incrementing
      if (result.status === "completed" || result.status === "failed" || result.status === "pending") {
        return {
          documentId: result.documentId,
          status: result.status,
          progress: result.progress,
        };
      }

      // Processing: increment progress
      const incremented = await analysisRepo.incrementProgress(result.id);

      if (!incremented) {
        throw new NotFoundException("Analysis result not found after increment");
      }

      // Transition to completed if progress reaches 100
      if (incremented.progress >= 100) {
        const completed = await analysisRepo.updateStatus(result.id, "completed");

        if (!completed) {
          throw new NotFoundException("Analysis result not found after status update");
        }

        return {
          documentId: completed.documentId,
          status: "completed",
          progress: completed.progress,
        };
      }

      return {
        documentId: incremented.documentId,
        status: incremented.status,
        progress: incremented.progress,
      };
    });
  }

  private mapToAnalysisResult(
    record: import("../infrastructure/postgres/repositories/analysis-results.repository").AnalysisResultRecord,
    entities: import("../infrastructure/postgres/repositories/entities.repository").EntityRecord[],
  ): AnalysisResult {
    return {
      documentId: record.documentId,
      status: record.status,
      progress: record.progress,
      startedAt: record.startedAt.toISOString(),
      completedAt: record.completedAt ? record.completedAt.toISOString() : null,
      entities: entities.map((e) => ({
        id: e.id,
        label: e.label,
        value: e.value,
        group: e.group,
        confidence: e.confidence,
        sourceSpan: e.sourceSpan,
        reviewed: e.reviewed,
        excluded: e.excluded,
      })),
    };
  }
}