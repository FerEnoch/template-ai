import { PoolClient } from "pg";
import { TemplateRecord } from "./templates.repository";

export interface CaseRecord {
  id: string;
  userId: number;
  templateId: string;
  status: string;
  name: string | null;
  formData: Record<string, string>;
  generatedText: string | null;
  createdAt: Date;
  updatedAt: Date;
  template: TemplateRecord | null;
}

export interface CreateCaseInput {
  userId: number;
  templateId: string;
}

const CASE_SELECT = `
  c.id, c.user_id, c.template_id, c.status, c.name, c.form_data, c.generated_text, c.created_at, c.updated_at,
  t.id AS t_id, t.user_id AS t_user_id, t.name AS t_name, t.description AS t_description,
  t.document_id AS t_document_id, t.category AS t_category, t.status AS t_status,
  t.entities AS t_entities, t.suggested_groups_status AS t_suggested_groups_status,
  t.created_at AS t_created_at, t.deleted_at AS t_deleted_at
`;

const CASE_JOIN = `LEFT JOIN templates t ON c.template_id = t.id`;

function rowToCase(row: Record<string, unknown>): CaseRecord {
  const formData = row["form_data"];
  const tId = row["t_id"] as string | null | undefined;
  return {
    id: row["id"] as string,
    userId: row["user_id"] as number,
    templateId: row["template_id"] as string,
    status: row["status"] as string,
    name: (row["name"] as string | null | undefined) ?? null,
    formData:
      typeof formData === "string"
        ? (JSON.parse(formData) as Record<string, string>)
        : (formData as Record<string, string>),
    generatedText: row["generated_text"] as string | null,
    createdAt: row["created_at"] as Date,
    updatedAt: row["updated_at"] as Date,
    template: tId
      ? {
          id: tId,
          userId: row["t_user_id"] as number,
          name: row["t_name"] as string,
          description: (row["t_description"] as string | null | undefined) ?? "",
          documentId: (row["t_document_id"] as string | null | undefined) ?? null,
          category: row["t_category"] as string,
          status: row["t_status"] as string,
          entities: row["t_entities"] as unknown[],
          suggestedGroupsStatus:
            (row["t_suggested_groups_status"] as Record<string, string> | undefined) ?? {},
          createdAt: row["t_created_at"] as Date,
          deletedAt: (row["t_deleted_at"] as Date | null | undefined) ?? null,
        }
      : null,
  };
}

export class CasesRepository {
  constructor(private readonly client: PoolClient) {}

  async create(input: CreateCaseInput): Promise<CaseRecord> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        INSERT INTO casos (user_id, template_id, status, form_data)
        VALUES ($1, $2, 'borrador', '{}')
        ON CONFLICT (user_id, template_id) WHERE status = 'borrador' DO NOTHING
        RETURNING id
      `,
      [input.userId, input.templateId],
    );

    // Conflict: a borrador for this (user, template) already exists.
    // Signal the caller to refetch via a synthetic unique-violation error.
    if (result.rowCount === 0 || !result.rows[0]) {
      const conflictErr = new Error(
        "borrador already exists for this user and template"
      );
      (conflictErr as unknown as Record<string, unknown>).code = "23505";
      throw conflictErr;
    }

    const id = result.rows[0]["id"] as string;
    const found = await this.findById(id);

    if (!found) {
      throw new Error("Failed to insert case");
    }

    return found;
  }

  async findById(id: string): Promise<CaseRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT ${CASE_SELECT}
        FROM casos c
        ${CASE_JOIN}
        WHERE c.id = $1
      `,
      [id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToCase(result.rows[0]);
  }

  async findBorradorByTemplate(
    userId: number,
    templateId: string,
  ): Promise<CaseRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT ${CASE_SELECT}
        FROM casos c
        ${CASE_JOIN}
        WHERE c.user_id = $1 AND c.template_id = $2 AND c.status = 'borrador'
        ORDER BY c.updated_at DESC
        LIMIT 1
      `,
      [userId, templateId],
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
      SELECT ${CASE_SELECT}
      FROM casos c
      ${CASE_JOIN}
      WHERE c.user_id = $1
    `;
    const params: unknown[] = [userId];

    if (statusFilter) {
      sql += ` AND c.status = $2`;
      params.push(statusFilter);
    }

    // Exclude archived cases by default when no status filter is applied
    if (!statusFilter) {
      sql += ` AND c.status != 'archivado'`;
    }

    sql += ` ORDER BY c.created_at DESC`;

    const result = await this.client.query<Record<string, unknown>>(
      sql,
      params,
    );

    return result.rows.map(rowToCase);
  }

  async findBorradorByUserAndTemplate(
    userId: number,
    templateId: string,
  ): Promise<CaseRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT ${CASE_SELECT}
        FROM casos c
        ${CASE_JOIN}
        WHERE c.user_id = $1 AND c.template_id = $2 AND c.status = 'borrador'
        ORDER BY c.created_at ASC LIMIT 1
      `,
      [userId, templateId],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToCase(result.rows[0]);
  }

  async updateFormData(
    id: string,
    formData: Record<string, string>,
  ): Promise<CaseRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        WITH updated AS (
          UPDATE casos
          SET form_data = $1, updated_at = now()
          WHERE id = $2
          RETURNING *
        )
        SELECT ${CASE_SELECT}
        FROM updated c
        ${CASE_JOIN}
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
        WITH updated AS (
          UPDATE casos
          SET status = $1, updated_at = now()
          WHERE id = $2
          RETURNING *
        )
        SELECT ${CASE_SELECT}
        FROM updated c
        ${CASE_JOIN}
      `,
      [status, id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToCase(result.rows[0]);
  }

  async updateName(
    id: string,
    name: string | null,
  ): Promise<CaseRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        WITH updated AS (
          UPDATE casos
          SET name = $1, updated_at = now()
          WHERE id = $2
          RETURNING *
        )
        SELECT ${CASE_SELECT}
        FROM updated c
        ${CASE_JOIN}
      `,
      [name, id],
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
        WITH updated AS (
          UPDATE casos
          SET generated_text = $1, status = 'generado', updated_at = now()
          WHERE id = $2 AND status != 'archivado'
          RETURNING *
        )
        SELECT ${CASE_SELECT}
        FROM updated c
        ${CASE_JOIN}
      `,
      [generatedText, id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToCase(result.rows[0]);
  }

  async saveGeneratedText(
    id: string,
    generatedText: string,
  ): Promise<CaseRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        WITH updated AS (
          UPDATE casos
          SET generated_text = $1, updated_at = now()
          WHERE id = $2
          RETURNING *
        )
        SELECT ${CASE_SELECT}
        FROM updated c
        ${CASE_JOIN}
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
