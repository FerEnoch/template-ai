import { Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import type { Job } from "bullmq";
import { DocumentAnalysisService } from "../ai/document-analysis.service.js";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { AnalysisResultsRepository } from "../infrastructure/postgres/repositories/analysis-results.repository";
import { DocumentsRepository } from "../infrastructure/postgres/repositories/documents.repository";
import { EntitiesRepository } from "../infrastructure/postgres/repositories/entities.repository";
import { ANALYSIS_QUEUE, type AnalysisJobPayload } from "./analysis.queue";

@Processor(ANALYSIS_QUEUE, { concurrency: 2 })
export class AnalysisProcessor extends WorkerHost {
  private readonly logger = new Logger(AnalysisProcessor.name);

  public constructor(
    private readonly postgres: PostgresService,
    private readonly documentAnalysisService: DocumentAnalysisService,
  ) {
    super();
  }

  public async process(job: Job<AnalysisJobPayload>) {
    const { analysisResultId, documentId, ownerId, filePath } = job.data;
    const maxAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
    const currentAttempt = job.attemptsMade + 1;

    this.logger.log(
      `Processing analysis job ${job.id} for analysisResultId=${analysisResultId} (attempt ${currentAttempt}/${maxAttempts})`,
    );

    const document = await this.postgres.withOwnerTransaction(ownerId, async ({ client }) => {
      const documentsRepo = new DocumentsRepository(client);
      return documentsRepo.findById(documentId);
    });

    const analysisResult = await this.documentAnalysisService.analyze(document?.filePath ?? filePath ?? null);

    if (!analysisResult.success) {
      const errorMessage = analysisResult.error ?? "Unknown error";
      const isTerminalAttempt = currentAttempt >= maxAttempts;

      if (this.isRetryableError(errorMessage) && !isTerminalAttempt) {
        this.logger.warn(
          `Retryable analysis failure for ${analysisResultId} on attempt ${currentAttempt}/${maxAttempts}: ${errorMessage}`,
        );
        throw new Error(errorMessage);
      }

      await this.markAnalysisAsFailed(analysisResultId, ownerId, errorMessage);
      return { status: "failed", analysisResultId, error: errorMessage };
    }

    await this.postgres.withOwnerTransaction(ownerId, async ({ client }) => {
      const analysisRepo = new AnalysisResultsRepository(client);
      const entitiesRepo = new EntitiesRepository(client);

      const entityInputs = (analysisResult.entities ?? []).map((entity) => ({
        analysisResultId,
        documentId,
        label: entity.label,
        value: entity.value,
        group: entity.group,
        confidence: entity.confidence,
        sourceSpan: entity.sourceSpan,
      }));

      if (entityInputs.length > 0) {
        await entitiesRepo.bulkInsert(entityInputs);
      }

      if (analysisResult.extractedText) {
        await analysisRepo.saveExtractedText(analysisResultId, analysisResult.extractedText);
      }

      await analysisRepo.updateStatus(analysisResultId, "completed");
    });

    return { status: "completed", analysisResultId };
  }

  private async markAnalysisAsFailed(
    analysisResultId: string,
    ownerId: number,
    errorMessage: string,
  ): Promise<void> {
    await this.postgres.withOwnerTransaction(ownerId, async ({ client }) => {
      const analysisRepo = new AnalysisResultsRepository(client);
      await analysisRepo.incrementRetryCount(analysisResultId, errorMessage);
      await analysisRepo.updateStatus(analysisResultId, "failed");
    });
  }

  private isRetryableError(errorMessage: string): boolean {
    const normalized = errorMessage.toUpperCase();
    return (
      normalized.includes("RATE_LIMIT") ||
      normalized.includes("NETWORK") ||
      normalized.includes("TIMEOUT") ||
      normalized.includes("INVALID_RESPONSE") ||
      normalized.includes("ECONN") ||
      normalized.includes("ETIMEDOUT")
    );
  }
}
