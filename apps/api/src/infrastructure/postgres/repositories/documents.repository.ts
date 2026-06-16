import { PoolClient } from "pg";
import type { EntityRecord } from "./entities.repository.js";

export interface DocumentRecord {
  id: string;
  userId: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  uploadedAt: Date;
  filePath: string | null;
  contentHash: string | null;
}

export interface CreateDocumentInput {
  userId: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  filePath?: string;
  contentHash?: string;
}

export interface CachedAnalysisResult {
  document: DocumentRecord;
  analysisResultId: string;
  entities: EntityRecord[];
}

const DOCUMENT_COLUMNS = "id, user_id, filename, mime_type, size_bytes, status, uploaded_at, file_path, content_hash";

function rowToDocument(row: Record<string, unknown>): DocumentRecord {
  return {
    id: row["id"] as string,
    userId: row["user_id"] as number,
    filename: row["filename"] as string,
    mimeType: row["mime_type"] as string,
    sizeBytes: row["size_bytes"] as number,
    status: row["status"] as string,
    uploadedAt: row["uploaded_at"] as Date,
    filePath: (row["file_path"] as string | null) ?? null,
    contentHash: (row["content_hash"] as string | null) ?? null,
  };
}

function rowToEntity(row: Record<string, unknown>): EntityRecord {
  return {
    id: row["id"] as string,
    analysisResultId: row["analysis_result_id"] as string,
    documentId: row["document_id"] as string,
    label: row["label"] as string,
    value: row["value"] as string,
    group: row["group"] as string,
    confidence: row["confidence"] as string,
    sourceSpan: row["source_span"] as { start: number; end: number } | null,
    reviewed: row["reviewed"] as boolean,
    excluded: row["excluded"] as boolean,
    userCreated: (row["user_created"] as boolean) ?? false,
  };
}

export class DocumentsRepository {
  constructor(private readonly client: PoolClient) {}

  async create(input: CreateDocumentInput): Promise<DocumentRecord> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        INSERT INTO documents (user_id, filename, mime_type, size_bytes, file_path, content_hash)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING ${DOCUMENT_COLUMNS}
      `,
      [input.userId, input.filename, input.mimeType, input.sizeBytes, input.filePath ?? null, input.contentHash ?? null],
    );

    if (result.rowCount === 0) {
      throw new Error("Failed to insert document");
    }

    return rowToDocument(result.rows[0]);
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT ${DOCUMENT_COLUMNS}
        FROM documents
        WHERE id = $1
      `,
      [id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToDocument(result.rows[0]);
  }

  async findByUserId(userId: number): Promise<DocumentRecord[]> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT ${DOCUMENT_COLUMNS}
        FROM documents
        WHERE user_id = $1
        ORDER BY uploaded_at DESC
      `,
      [userId],
    );

    return result.rows.map(rowToDocument);
  }

  async updateStatus(id: string, status: string): Promise<DocumentRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        UPDATE documents SET status = $1
        WHERE id = $2
        RETURNING ${DOCUMENT_COLUMNS}
      `,
      [status, id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToDocument(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.client.query(
      `DELETE FROM documents WHERE id = $1`,
      [id],
    );

    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Find a document with a completed analysis result matching the given content hash.
   * Used for upload deduplication — if a byte-identical file was already analyzed,
   * return the cached result instead of re-processing.
   *
   * Returns null if no completed analysis exists for this hash.
   */
  async findByContentHashWithCompletedAnalysis(
    contentHash: string,
  ): Promise<CachedAnalysisResult | null> {
    // Step 1: Find document + analysis_result with completed status
    const joinResult = await this.client.query<Record<string, unknown>>(
      `
        SELECT d.id, d.user_id, d.filename, d.mime_type, d.size_bytes,
               d.status, d.uploaded_at, d.file_path, d.content_hash,
               ar.id AS analysis_result_id
        FROM documents d
        JOIN analysis_results ar ON ar.document_id = d.id
        WHERE d.content_hash = $1 AND ar.status = 'completed'
        ORDER BY ar.completed_at DESC
        LIMIT 1
      `,
      [contentHash],
    );

    if (joinResult.rowCount === 0 || joinResult.rows.length === 0) {
      return null;
    }

    const row = joinResult.rows[0];
    const document = rowToDocument(row);
    const analysisResultId = row["analysis_result_id"] as string;

    // Step 2: Fetch entities for the completed analysis
    const entitiesResult = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, analysis_result_id, document_id, label, value, "group",
               confidence, source_span, reviewed, excluded, user_created
        FROM entities
        WHERE analysis_result_id = $1
        ORDER BY label
      `,
      [analysisResultId],
    );

    const entities = entitiesResult.rows.map(rowToEntity);

    return { document, analysisResultId, entities };
  }
}