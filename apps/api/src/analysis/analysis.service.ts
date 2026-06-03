import { Injectable, NotFoundException, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import type { Queue } from "bullmq";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { AnalysisResultsRepository } from "../infrastructure/postgres/repositories/analysis-results.repository";
import { EntitiesRepository } from "../infrastructure/postgres/repositories/entities.repository";
import { DocumentsRepository } from "../infrastructure/postgres/repositories/documents.repository";
import { ANALYSIS_QUEUE, type AnalysisJobPayload } from "./analysis.queue";

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
  extractedText: string | null;
}

export interface AnalysisEntity {
  id: string;
  label: string;
  value: string;
  group: string;
  confidence: string;
  sourceSpan: { start: number; end: number } | null | undefined;
  reviewed: boolean;
  excluded: boolean;
}

export interface AnalysisStatus {
  documentId: string;
  status: string;
  progress: number;
}

// ---------------------------------------------------------------------------
// Internal phase result types (not exported)
// ---------------------------------------------------------------------------

type Phase1Result =
  | { type: "completed"; result: AnalysisResult }
  | { type: "terminal"; result: AnalysisResult }
  | { type: "in-progress"; result: AnalysisResult }
  | { type: "needs-ai"; analysisResultId: string; documentId: string };

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  public constructor(
    private readonly postgres: PostgresService,
    @InjectQueue(ANALYSIS_QUEUE)
    private readonly analysisQueue: Queue<AnalysisJobPayload>,
  ) {}

  /**
   * GET /:id — Returns the full analysis result, including entities.
   *
   * Three-phase async architecture:
   *   Phase 1 — Short transaction: increment progress, transition to "analyzing"
   *   Phase 2 — Enqueue job: fetch document path, add BullMQ job, return immediately
   *   Phase 3 — Worker (analysis.processor.ts): AI extraction + entity insert + status update
   */
  async getFullResult(documentId: string): Promise<AnalysisResult> {
    // -----------------------------------------------------------------------
    // Fase 1: Transacción corta — incrementar progress o detectar estados terminales
    // -----------------------------------------------------------------------
    const phase1Result = await this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const analysisRepo = new AnalysisResultsRepository(client);

      const results = await analysisRepo.findByDocumentId(documentId);
      if (results.length === 0) {
        throw new NotFoundException("Analysis result not found");
      }

      const result = results[0];

      this.logger.debug(
        `Phase 1: documentId=${documentId} status=${result.status} progress=${result.progress} retryCount=${result.retryCount}`,
      );

      // Terminal states — return as-is
      if (result.status === "completed") {
        const entitiesRepo = new EntitiesRepository(client);
        const entities = await entitiesRepo.findByAnalysisResultId(result.id);
        return { type: "completed" as const, result: this.mapToAnalysisResult(result, entities) };
      }
      if (result.status === "failed") {
        // Terminal — once failed, stay failed. No more progress increments.
        return { type: "terminal" as const, result: this.mapToAnalysisResult(result, []) };
      }
      if (result.status === "pending") {
        return { type: "terminal" as const, result: this.mapToAnalysisResult(result, []) };
      }
      if (result.status === "analyzing") {
        // Another request already triggered the AI call — return terminal.
        // Entities will be empty until Phase 3 completes.
        return { type: "terminal" as const, result: this.mapToAnalysisResult(result, []) };
      }

      // Processing: increment progress
      const incremented = await analysisRepo.incrementProgress(result.id);
      if (!incremented) {
        throw new NotFoundException("Analysis result not found after increment");
      }

      if (incremented.progress >= 100) {
        // Atomic guard: only ONE request wins the transition to "analyzing".
        // If another concurrent request already claimed it, we return terminal
        // (entities will be populated when Phase 3 of the winner completes).
        const transitioned = await analysisRepo.atomicTransitionToAnalyzing(result.id);
        if (transitioned) {
          this.logger.log(
            `Phase 1: documentId=${documentId} TRANSITION → analyzing (progress=100)`,
          );
          return { type: "needs-ai" as const, analysisResultId: result.id, documentId };
        }
        // Another request is already handling the AI call — return terminal
        return { type: "terminal" as const, result: this.mapToAnalysisResult(incremented, []) };
      }

      // Still processing — return incremented result
      return { type: "in-progress" as const, result: this.mapToAnalysisResult(incremented, []) };
    });

    // Handle early returns from Phase 1
    if (phase1Result.type === "completed") return phase1Result.result;
    if (phase1Result.type === "terminal") return phase1Result.result;
    if (phase1Result.type === "in-progress") return phase1Result.result;

    // -----------------------------------------------------------------------
    // Fase 2: Encolar job para procesamiento asíncrono y retornar inmediatamente
    // El worker (analysis.processor.ts) se encarga de la extracción AI
    // y la escritura de entidades (Fase 3).
    // -----------------------------------------------------------------------
    const document = await this.fetchDocument(phase1Result.documentId, 0);
    this.logger.log(
      `Phase 2: document ${phase1Result.documentId} — ` +
      `${document ? `found, filePath=${document.filePath ?? '(null)'}` : "NOT FOUND (null)"}`,
    );

    try {
      await this.analysisQueue.add("analyze", {
        analysisResultId: phase1Result.analysisResultId,
        documentId: phase1Result.documentId,
        ownerId: 0,
        filePath: document?.filePath ?? null,
      });

      this.logger.log(
        `Phase 2: analysis job enqueued for ${phase1Result.analysisResultId}`,
      );
    } catch (error) {
      this.logger.error(
        `Phase 2: failed to enqueue analysis job — ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new HttpException(
        "El servicio de análisis no está disponible en este momento. Reintentá en unos segundos.",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Return immediately with the current analysis state.
    // The status is "analyzing" — entities will be populated by the worker.
    // The frontend polls GET /:id/status until "completed", then fetches GET /:id for entities.
    return this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const analysisRepo = new AnalysisResultsRepository(client);
      const results = await analysisRepo.findByDocumentId(documentId);
      if (results.length === 0) {
        throw new NotFoundException("Analysis result not found after enqueue");
      }
      return this.mapToAnalysisResult(results[0], []);
    });
  }

  /**
   * GET /:id/status — Lightweight read-only poll returning only documentId, status, progress.
   *
   * Does NOT increment progress or transition status — that is exclusively
   * handled by GET /:id (getFullResult). This makes the status endpoint safe
   * for aggressive polling (e.g. every 800ms) without race conditions or
   * duplicate AI triggers.
   */
  async getStatus(documentId: string, ownerId: number = 0): Promise<AnalysisStatus> {
    return this.postgres.withOwnerTransaction(ownerId, async ({ client }) => {
      const analysisRepo = new AnalysisResultsRepository(client);

      const results = await analysisRepo.findByDocumentId(documentId);
      if (results.length === 0) {
        throw new NotFoundException("Analysis result not found");
      }

      const result = results[0];
      return {
        documentId: result.documentId,
        status: result.status,
        progress: result.progress,
      };
    });
  }

  /**
   * Fetch a document within an owner-scoped transaction so RLS policies
   * can resolve app.current_user_id and enforce row isolation.
   */
  private async fetchDocument(
    documentId: string,
    ownerId: number = 0,
  ): Promise<{ id: string; filePath: string | null } | null> {
    return this.postgres.withOwnerTransaction(ownerId, async ({ client }) => {
      const repo = new DocumentsRepository(client);
      return await repo.findById(documentId);
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
      extractedText: record.extractedText,
      entities: entities.map((e) => ({
        id: e.id,
        label: e.label,
        value: e.value,
        group: e.group,
        confidence: e.confidence,
        sourceSpan: e.sourceSpan ?? undefined,
        reviewed: e.reviewed,
        excluded: e.excluded,
      })),
    };
  }
}
