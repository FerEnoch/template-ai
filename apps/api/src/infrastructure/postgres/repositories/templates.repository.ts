import { PoolClient } from "pg";

export interface TemplateRecord {
  id: string;
  userId: number;
  name: string;
  description: string;
  documentId: string | null;
  category: string;
  status: string;
  entities: unknown[];
  createdAt: Date;
  deletedAt: Date | null;
}

export interface CreateTemplateInput {
  userId: number;
  name: string;
  description?: string;
  documentId: string;
  category: string;
  status?: string;
  entities: unknown[];
}

function rowToTemplate(row: Record<string, unknown>): TemplateRecord {
  return {
    id: row["id"] as string,
    userId: row["user_id"] as number,
    name: row["name"] as string,
    description: row["description"] as string,
    documentId: (row["document_id"] as string | null | undefined) ?? null,
    category: row["category"] as string,
    status: row["status"] as string,
    entities: row["entities"] as unknown[],
    createdAt: row["created_at"] as Date,
    deletedAt: (row["deleted_at"] as Date | null | undefined) ?? null,
  };
}

export class TemplatesRepository {
  constructor(private readonly client: PoolClient) {}

  async create(input: CreateTemplateInput): Promise<TemplateRecord> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        INSERT INTO templates (user_id, name, description, document_id, category, status, entities)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, user_id, name, description, document_id, category, status, entities, created_at, deleted_at
      `,
      [
        input.userId,
        input.name,
        input.description ?? "",
        input.documentId,
        input.category,
        input.status ?? "draft",
        JSON.stringify(input.entities),
      ],
    );

    if (result.rowCount === 0) {
      throw new Error("Failed to insert template");
    }

    return rowToTemplate(result.rows[0]);
  }

  async findById(id: string): Promise<TemplateRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, user_id, name, description, document_id, category, status, entities, created_at, deleted_at
        FROM templates
        WHERE id = $1
      `,
      [id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToTemplate(result.rows[0]);
  }

  async findByUserId(
    userId: number,
    includeArchived = false,
  ): Promise<TemplateRecord[]> {
    const archivedFilter = includeArchived ? "" : "AND status != 'archived'";
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, user_id, name, description, document_id, category, status, entities, created_at, deleted_at
        FROM templates
        WHERE user_id = $1 ${archivedFilter}
        ORDER BY created_at DESC
      `,
      [userId],
    );

    return result.rows.map(rowToTemplate);
  }

  /**
   * Find a template by name and userId — used for 409 uniqueness check.
   */
  async findByNameAndUserId(name: string, userId: number): Promise<TemplateRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, user_id, name, description, document_id, category, status, entities, created_at, deleted_at
        FROM templates
        WHERE name = $1 AND user_id = $2
      `,
      [name, userId],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToTemplate(result.rows[0]);
  }

  async updateStatus(id: string, status: string): Promise<TemplateRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        UPDATE templates
        SET status = $1
        WHERE id = $2
        RETURNING id, user_id, name, description, document_id, category, status, entities, created_at, deleted_at
      `,
      [status, id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToTemplate(result.rows[0]);
  }

  /**
   * Soft-delete a template by setting status to 'archived' and stamping deleted_at.
   * Returns the archived record, or null if already archived.
   */
  async softDelete(id: string): Promise<TemplateRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        UPDATE templates
        SET status = 'archived', deleted_at = NOW()
        WHERE id = $1 AND status <> 'archived'
        RETURNING id, user_id, name, description, document_id, category, status, entities, created_at, deleted_at
      `,
      [id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToTemplate(result.rows[0]);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.client.query(
      `DELETE FROM templates WHERE id = $1`,
      [id],
    );

    return (result.rowCount ?? 0) > 0;
  }
}
