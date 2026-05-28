import { Injectable } from "@nestjs/common";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { DocumentsRepository } from "../infrastructure/postgres/repositories/documents.repository";
import { AnalysisResultsRepository } from "../infrastructure/postgres/repositories/analysis-results.repository";
import type { DocumentRecord } from "../infrastructure/postgres/repositories/documents.repository";

export interface UploadInput {
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class DocumentsService {
  public constructor(private readonly postgres: PostgresService) {}

  async upload(input: UploadInput): Promise<DocumentRecord> {
    return this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const documentsRepo = new DocumentsRepository(client);
      const analysisResultsRepo = new AnalysisResultsRepository(client);

      const document = await documentsRepo.create({
        userId: 0,
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      });

      await analysisResultsRepo.create({
        documentId: document.id,
        status: "processing",
      });

      return document;
    });
  }
}