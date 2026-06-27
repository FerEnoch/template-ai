import { PoolClient } from "pg";

export interface CaseRecord {
  id: string;
  userId: number;
  templateId: string;
  status: string;
  formData: Record<string, string>;
  generatedText: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCaseInput {
  userId: number;
  templateId: string;
}

function rowToCase(row: Record<string, unknown>): CaseRecord {
  const formData = row["form_data"];
  return {
    id: row["id"] as string,
    userId: row["user_id"] as number,
    templateId: row["template_id"] as string,
    status: row["status"] as string,
    formData:
      typeof formData === "string"
        ? (JSON.parse(formData) as Record<string, string>)
        : (formData as Record<string, string>),
    generatedText: row["generated_text"] as string | null,
    createdAt: row["created_at"] as Date,
    updatedAt: row["updated_at"] as Date,
  };
}

export class CasesRepository {
  constructor(private readonly client: PoolClient) {}

  async create(input: CreateCaseInput): Promise<CaseRecord> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        INSERT INTO casos (user_id, template_id, status, form_data)
        VALUES ($1, $2, 'borrador', '{}')
        RETURNING id, user_id, template_id, status, form_data, generated_text, created_at, updated_at
      `,
      [input.userId, input.templateId],
    );

    if (result.rowCount === 0) {
      throw new Error("Failed to insert case");
    }

    return rowToCase(result.rows[0]);
  }

  async findById(id: string): Promise<CaseRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, user_id, template_id, status, form_data, generated_text, created_at, updated_at
        FROM casos
        WHERE id = $1
      `,
      [id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToCase(result.rows[0]);
  }

  async findByUserId(
    userId: number,
    statusFilter?: string,
  ): Promise<CaseRecord[]> {
    let sql = `
      SELECT id, user_id, template_id, status, form_data, generated_text, created_at, updated_at
      FROM casos
      WHERE user_id = $1
    `;
    const params: unknown[] = [userId];

    if (statusFilter) {
      sql += ` AND status = $2`;
      params.push(statusFilter);
    }

    // Exclude archived cases by default when no status filter is applied
    if (!statusFilter) {
      sql += ` AND status != 'archivado'`;
    }

    sql += ` ORDER BY created_at DESC`;

    const result = await this.client.query<Record<string, unknown>>(
      sql,
      params,
    );

    return result.rows.map(rowToCase);
  }

  async updateFormData(
    id: string,
    formData: Record<string, string>,
  ): Promise<CaseRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        UPDATE casos
        SET form_data = $1, updated_at = now()
        WHERE id = $2
        RETURNING id, user_id, template_id, status, form_data, generated_text, created_at, updated_at
      `,
      [JSON.stringify(formData), id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToCase(result.rows[0]);
  }

  async updateStatus(
    id: string,
    status: string,
  ): Promise<CaseRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        UPDATE casos
        SET status = $1, updated_at = now()
        WHERE id = $2
        RETURNING id, user_id, template_id, status, form_data, generated_text, created_at, updated_at
      `,
      [status, id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToCase(result.rows[0]);
  }

  async updateGeneratedText(
    id: string,
    generatedText: string,
  ): Promise<CaseRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        UPDATE casos
        SET generated_text = $1, status = 'generado', updated_at = now()
        WHERE id = $2
        RETURNING id, user_id, template_id, status, form_data, generated_text, created_at, updated_at
      `,
      [generatedText, id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToCase(result.rows[0]);
  }

  /**
   * Archive all cases linked to a template.
   */
  async archiveByTemplateId(templateId: string): Promise<number> {
    const result = await this.client.query(
      `
        UPDATE casos
        SET status = 'archivado', updated_at = now()
        WHERE template_id = $1 AND status != 'archivado'
      `,
      [templateId],
    );

    return result.rowCount ?? 0;
  }
}
