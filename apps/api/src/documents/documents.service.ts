import { Injectable, Logger } from "@nestjs/common";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { DocumentsRepository } from "../infrastructure/postgres/repositories/documents.repository";
import { AnalysisResultsRepository } from "../infrastructure/postgres/repositories/analysis-results.repository";
import type { DocumentRecord } from "../infrastructure/postgres/repositories/documents.repository";
import type { EntityRecord } from "../infrastructure/postgres/repositories/entities.repository";
import { CACHE_CONFIG, UPLOAD_DIR } from "../config/ai.js";

export interface UploadInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  fileBuffer: Buffer;
  contentHash: string;
}

export interface UploadResult {
  document: DocumentRecord;
  cacheHit: boolean;
  cachedFromDocumentId?: string;
  analysisResultId?: string;
  entities?: EntityRecord[];
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  public constructor(private readonly postgres: PostgresService) {}

  async upload(input: UploadInput): Promise<UploadResult> {
    // -------------------------------------------------------------------
    // Dedup check: if cache is enabled and a completed analysis exists
    // for this content hash, return it immediately — skip disk write,
    // DB inserts, and BullMQ enqueue.
    // -------------------------------------------------------------------
    if (CACHE_CONFIG.enabled && input.contentHash) {
      try {
        const cached = await this.postgres.withOwnerTransaction(0, async ({ client }) => {
          const documentsRepo = new DocumentsRepository(client);
          return documentsRepo.findByContentHashWithCompletedAnalysis(input.contentHash);
        });

        if (cached) {
          this.logger.log(
            `Upload cache HIT: contentHash=${input.contentHash} → documentId=${cached.document.id}`,
          );
          return {
            document: cached.document,
            cacheHit: true,
            cachedFromDocumentId: cached.document.id,
            analysisResultId: cached.analysisResultId,
            entities: cached.entities,
          };
        }
      } catch (error) {
        // Dedup failure must not break the upload — fall through to normal flow
        this.logger.warn(
          `Dedup check failed for contentHash=${input.contentHash}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // -------------------------------------------------------------------
    // Cache MISS (or cache disabled): write file to disk, create document
    // and analysis_result, return with cacheHit=false.
    // -------------------------------------------------------------------
    const uniqueName = `${randomUUID()}${extname(input.filename)}`;
    const filePath = join(UPLOAD_DIR, uniqueName);

    await writeFile(filePath, input.fileBuffer);

    const result = await this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const documentsRepo = new DocumentsRepository(client);
      const analysisResultsRepo = new AnalysisResultsRepository(client);

      const document = await documentsRepo.create({
        userId: 0,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        filePath,
        contentHash: CACHE_CONFIG.enabled ? input.contentHash : undefined,
      });

      const analysisResult = await analysisResultsRepo.create({
        documentId: document.id,
        status: "processing",
      });

      return { document, analysisResultId: analysisResult.id };
    });

    this.logger.log(
      `Upload cache MISS: contentHash=${input.contentHash} → documentId=${result.document.id}`,
    );

    return {
      document: result.document,
      cacheHit: false,
      analysisResultId: result.analysisResultId,
    };
  }
}