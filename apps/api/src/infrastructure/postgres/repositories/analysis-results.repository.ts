import { PoolClient } from "pg";

export interface AnalysisResultRecord {
  id: string;
  documentId: string;
  status: string;
  progress: number;
  startedAt: Date;
  completedAt: Date | null;
  retryCount: number;
  errorMessage: string | null;
}

export interface CreateAnalysisResultInput {
  documentId: string;
  status: string;
}

function rowToAnalysisResult(row: Record<string, unknown>): AnalysisResultRecord {
  return {
    id: row["id"] as string,
    documentId: row["document_id"] as string,
    status: row["status"] as string,
    progress: row["progress"] as number,
    startedAt: row["started_at"] as Date,
    completedAt: row["completed_at"] as Date | null,
    retryCount: (row["retry_count"] as number) ?? 0,
    errorMessage: (row["error_message"] as string | null) ?? null,
  };
}

export class AnalysisResultsRepository {
  constructor(private readonly client: PoolClient) {}

  async create(input: CreateAnalysisResultInput): Promise<AnalysisResultRecord> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        INSERT INTO analysis_results (document_id, status)
        VALUES ($1, $2)
        RETURNING id, document_id, status, progress, started_at, completed_at, retry_count, error_message
      `,
      [input.documentId, input.status],
    );

    if (result.rowCount === 0) {
      throw new Error("Failed to insert analysis result");
    }

    return rowToAnalysisResult(result.rows[0]);
  }

  async findById(id: string): Promise<AnalysisResultRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, document_id, status, progress, started_at, completed_at, retry_count, error_message
        FROM analysis_results
        WHERE id = $1
      `,
      [id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToAnalysisResult(result.rows[0]);
  }

  async findByDocumentId(documentId: string): Promise<AnalysisResultRecord[]> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, document_id, status, progress, started_at, completed_at, retry_count, error_message
        FROM analysis_results
        WHERE document_id = $1
        ORDER BY started_at DESC
      `,
      [documentId],
    );

    return result.rows.map(rowToAnalysisResult);
  }

  /**
   * Increment progress by 25, capped at 100.
   * Returns the updated record, or null if not found.
   */
  async incrementProgress(id: string): Promise<AnalysisResultRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        UPDATE analysis_results
        SET progress = LEAST(progress + 25, 100)
        WHERE id = $1
        RETURNING id, document_id, status, progress, started_at, completed_at, retry_count, error_message
      `,
      [id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToAnalysisResult(result.rows[0]);
  }

  async updateStatus(id: string, status: string): Promise<AnalysisResultRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        UPDATE analysis_results
        SET status = $1,
            completed_at = CASE WHEN $1 = 'completed' THEN now() ELSE completed_at END
        WHERE id = $2
        RETURNING id, document_id, status, progress, started_at, completed_at, retry_count, error_message
      `,
      [status, id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToAnalysisResult(result.rows[0]);
  }

  /**
   * Increment the retry count and set the error message.
   * Returns the updated record, or null if not found.
   * The DB constraint retry_count_range ensures retry_count stays within [0, 3].
   */
  async incrementRetryCount(id: string, errorMessage: string): Promise<AnalysisResultRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        UPDATE analysis_results
        SET retry_count = retry_count + 1,
            error_message = $2
        WHERE id = $1 AND retry_count < 3
        RETURNING id, document_id, status, progress, started_at, completed_at, retry_count, error_message
      `,
      [id, errorMessage],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToAnalysisResult(result.rows[0]);
  }
}