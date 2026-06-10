import { PoolClient } from "pg";

export interface EntityRecord {
  id: string;
  analysisResultId: string;
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

export interface CreateEntityInput {
  analysisResultId: string;
  documentId: string;
  label: string;
  value: string;
  group: string;
  confidence: string;
  sourceSpan?: { start: number; end: number };
  userCreated?: boolean;
}

export interface UpdateEntityInput {
  label?: string;
  value?: string;
  group?: string;
  confidence?: string;
  sourceSpan?: { start: number; end: number } | null;
  reviewed?: boolean;
  excluded?: boolean;
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

export class EntitiesRepository {
  constructor(private readonly client: PoolClient) {}

  async create(input: CreateEntityInput): Promise<EntityRecord> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        INSERT INTO entities (analysis_result_id, document_id, label, value, "group", confidence, source_span, user_created)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, analysis_result_id, document_id, label, value, "group", confidence, source_span, reviewed, excluded, user_created
      `,
      [
        input.analysisResultId,
        input.documentId,
        input.label,
        input.value,
        input.group,
        input.confidence,
        input.sourceSpan ? JSON.stringify(input.sourceSpan) : null,
        input.userCreated ?? false,
      ],
    );

    if (result.rowCount === 0) {
      throw new Error("Failed to insert entity");
    }

    return rowToEntity(result.rows[0]);
  }

  async bulkInsert(inputs: CreateEntityInput[]): Promise<EntityRecord[]> {
    if (inputs.length === 0) return [];

    const values: unknown[] = [];
    const placeholders: string[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const offset = i * 8;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`);
      values.push(
        inputs[i].analysisResultId,
        inputs[i].documentId,
        inputs[i].label,
        inputs[i].value,
        inputs[i].group,
        inputs[i].confidence,
        inputs[i].sourceSpan ? JSON.stringify(inputs[i].sourceSpan) : null,
        inputs[i].userCreated ?? false,
      );
    }

    const result = await this.client.query<Record<string, unknown>>(
      `
        INSERT INTO entities (analysis_result_id, document_id, label, value, "group", confidence, source_span, user_created)
        VALUES ${placeholders.join(", ")}
        RETURNING id, analysis_result_id, document_id, label, value, "group", confidence, source_span, reviewed, excluded, user_created
      `,
      values,
    );

    return result.rows.map(rowToEntity);
  }

  async findById(id: string): Promise<EntityRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, analysis_result_id, document_id, label, value, "group", confidence, source_span, reviewed, excluded, user_created
        FROM entities
        WHERE id = $1
      `,
      [id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToEntity(result.rows[0]);
  }

  async findByAnalysisResultId(analysisResultId: string): Promise<EntityRecord[]> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, analysis_result_id, document_id, label, value, "group", confidence, source_span, reviewed, excluded, user_created
        FROM entities
        WHERE analysis_result_id = $1
        ORDER BY label
      `,
      [analysisResultId],
    );

    return result.rows.map(rowToEntity);
  }

  async update(id: string, input: UpdateEntityInput): Promise<EntityRecord | null> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (input.label !== undefined) {
      setClauses.push(`label = $${paramIdx++}`);
      values.push(input.label);
    }
    if (input.value !== undefined) {
      setClauses.push(`value = $${paramIdx++}`);
      values.push(input.value);
    }
    if (input.group !== undefined) {
      setClauses.push(`"group" = $${paramIdx++}`);
      values.push(input.group);
    }
    if (input.confidence !== undefined) {
      setClauses.push(`confidence = $${paramIdx++}`);
      values.push(input.confidence);
    }
    if (input.sourceSpan !== undefined) {
      setClauses.push(`source_span = $${paramIdx++}`);
      values.push(input.sourceSpan ? JSON.stringify(input.sourceSpan) : null);
    }
    if (input.reviewed !== undefined) {
      setClauses.push(`reviewed = $${paramIdx++}`);
      values.push(input.reviewed);
    }
    if (input.excluded !== undefined) {
      setClauses.push(`excluded = $${paramIdx++}`);
      values.push(input.excluded);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    values.push(id);

    const result = await this.client.query<Record<string, unknown>>(
      `
        UPDATE entities
        SET ${setClauses.join(", ")}
        WHERE id = $${paramIdx}
        RETURNING id, analysis_result_id, document_id, label, value, "group", confidence, source_span, reviewed, excluded, user_created
      `,
      values,
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToEntity(result.rows[0]);
  }

  async deleteByDocumentId(documentId: string): Promise<number> {
    const result = await this.client.query(
      `DELETE FROM entities WHERE document_id = $1`,
      [documentId],
    );

    return result.rowCount ?? 0;
  }

  /**
   * Count user-created (manual) entities for a given document.
   * Used to enforce the per-document manual entity cap.
   */
  async countUserCreated(documentId: string): Promise<number> {
    const result = await this.client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM entities WHERE document_id = $1 AND user_created = true`,
      [documentId],
    );

    return Number(result.rows[0]?.count ?? 0);
  }
}