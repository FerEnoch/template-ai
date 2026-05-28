import { PoolClient } from "pg";

export interface DocumentRecord {
  id: string;
  userId: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  uploadedAt: Date;
}

export interface CreateDocumentInput {
  userId: number;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

function rowToDocument(row: Record<string, unknown>): DocumentRecord {
  return {
    id: row["id"] as string,
    userId: row["user_id"] as number,
    filename: row["filename"] as string,
    mimeType: row["mime_type"] as string,
    sizeBytes: row["size_bytes"] as number,
    status: row["status"] as string,
    uploadedAt: row["uploaded_at"] as Date,
  };
}

export class DocumentsRepository {
  constructor(private readonly client: PoolClient) {}

  async create(input: CreateDocumentInput): Promise<DocumentRecord> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        INSERT INTO documents (user_id, filename, mime_type, size_bytes)
        VALUES ($1, $2, $3, $4)
        RETURNING id, user_id, filename, mime_type, size_bytes, status, uploaded_at
      `,
      [input.userId, input.filename, input.mimeType, input.sizeBytes],
    );

    if (result.rowCount === 0) {
      throw new Error("Failed to insert document");
    }

    return rowToDocument(result.rows[0]);
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, user_id, filename, mime_type, size_bytes, status, uploaded_at
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
        SELECT id, user_id, filename, mime_type, size_bytes, status, uploaded_at
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
        RETURNING id, user_id, filename, mime_type, size_bytes, status, uploaded_at
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
}