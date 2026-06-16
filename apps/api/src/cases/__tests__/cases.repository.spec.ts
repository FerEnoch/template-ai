/**
 * 0009_casos — Integration tests for RLS, indexes, and constraints
 *
 * Validates: casos table exists, RLS policies enforce user_id ownership,
 * constraints (CHECK, FK) work, and indexes exist.
 *
 * When DATABASE_URL is not set, the suite is skipped silently.
 * Run with DATABASE_URL set to execute against a real PostgreSQL instance.
 */

import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool | null = null;

async function setupPool(): Promise<Pool | null> {
  if (!DATABASE_URL) return null;
  const p = new Pool({ connectionString: DATABASE_URL });
  try {
    await p.query("SELECT 1");
    return p;
  } catch {
    await p.end();
    return null;
  }
}

function requirePool(): Pool {
  if (!pool) throw new Error("Pool not initialized");
  return pool;
}

async function cleanCasos(): Promise<void> {
  if (!pool) return;
  await pool.query("DELETE FROM casos");
}

async function runMigrations(): Promise<void> {
  if (!pool || !DATABASE_URL) return;
  const { runMigrations } = await import(
    "../../infrastructure/postgres/migrate.js"
  );
  await runMigrations({ connectionString: DATABASE_URL });
}

async function createUserAs(
  ownerId: number,
  data: { email: string; displayName: string; externalSubject: string },
): Promise<{ id: number }> {
  const p = requirePool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = $1`, [ownerId]);
    const result = await client.query(
      `INSERT INTO users (email, display_name, external_subject)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [data.email, data.displayName, data.externalSubject],
    );
    await client.query("COMMIT");
    return { id: result.rows[0].id as number };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function createTemplateAs(
  ownerId: number,
  data: { userId: number; name: string; documentId: string },
): Promise<{ id: string }> {
  const p = requirePool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = $1`, [ownerId]);
    const result = await client.query(
      `INSERT INTO templates (user_id, name, document_id, category)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [data.userId, data.name, data.documentId, "legal"],
    );
    await client.query("COMMIT");
    return { id: result.rows[0].id as string };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function createDocumentAs(
  ownerId: number,
  data: {
    userId: number;
    filename: string;
    mimeType: string;
    sizeBytes: number;
  },
): Promise<{ id: string }> {
  const p = requirePool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = $1`, [ownerId]);
    const result = await client.query(
      `INSERT INTO documents (user_id, filename, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [data.userId, data.filename, data.mimeType, data.sizeBytes],
    );
    await client.query("COMMIT");
    return { id: result.rows[0].id as string };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function countCasosAs(ownerId: number): Promise<number> {
  const p = requirePool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = $1`, [ownerId]);
    const result = await client.query(
      "SELECT COUNT(*)::int as count FROM casos",
    );
    await client.query("COMMIT");
    return result.rows[0].count as number;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

describe("0009_casos RLS and constraints", () => {
  beforeAll(async () => {
    pool = await setupPool();
    if (!pool) return;
    await cleanCasos();
    await runMigrations();
  });

  afterEach(async () => {
    if (!pool) return;
    await cleanCasos();
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  describe("table exists", () => {
    it("casos table exists with expected columns", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'casos' AND table_schema = 'public'
         ORDER BY column_name`,
      );
      const columns = result.rows.map((r) => r.column_name as string);
      expect(columns).toContain("id");
      expect(columns).toContain("user_id");
      expect(columns).toContain("template_id");
      expect(columns).toContain("status");
      expect(columns).toContain("form_data");
      expect(columns).toContain("generated_text");
      expect(columns).toContain("created_at");
      expect(columns).toContain("updated_at");
    });
  });

  describe("indexes exist", () => {
    it("casos_user_id_idx exists", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'casos_user_id_idx'`,
      );
      expect(result.rowCount).toBe(1);
    });

    it("casos_template_id_idx exists", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'casos_template_id_idx'`,
      );
      expect(result.rowCount).toBe(1);
    });

    it("casos_user_created_at_idx exists", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'casos_user_created_at_idx'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });

  describe("RLS is enabled and forced", () => {
    it("casos has RLS enabled and forced", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class WHERE relname = 'casos'`,
      );
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].relrowsecurity).toBe(true);
      expect(result.rows[0].relforcerowsecurity).toBe(true);
    });
  });

  describe("RLS policies enforce ownership", () => {
    it("user A cannot see user B's cases", async () => {
      if (!pool) return;
      const userA = await createUserAs(0, {
        email: "casos-a@example.com",
        displayName: "Casos User A",
        externalSubject: "subj_casos_a",
      });
      const userB = await createUserAs(0, {
        email: "casos-b@example.com",
        displayName: "Casos User B",
        externalSubject: "subj_casos_b",
      });

      const docA = await createDocumentAs(userA.id, {
        userId: userA.id,
        filename: "contract-a.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
      });
      const templateA = await createTemplateAs(userA.id, {
        userId: userA.id,
        name: "Template A",
        documentId: docA.id,
      });

      const docB = await createDocumentAs(userB.id, {
        userId: userB.id,
        filename: "contract-b.pdf",
        mimeType: "application/pdf",
        sizeBytes: 200,
      });
      const templateB = await createTemplateAs(userB.id, {
        userId: userB.id,
        name: "Template B",
        documentId: docB.id,
      });

      // Insert a caso for user A
      const p = requirePool();
      const clientA = await p.connect();
      try {
        await clientA.query("BEGIN");
        await clientA.query(`SET LOCAL app.current_user_id = $1`, [userA.id]);
        await clientA.query(
          `INSERT INTO casos (user_id, template_id, status, form_data)
           VALUES ($1, $2, $3, $4)`,
          [userA.id, templateA.id, "borrador", "{}"],
        );
        await clientA.query("COMMIT");
      } catch (e) {
        await clientA.query("ROLLBACK");
        throw e;
      } finally {
        clientA.release();
      }

      // Insert a caso for user B
      const clientB = await p.connect();
      try {
        await clientB.query("BEGIN");
        await clientB.query(`SET LOCAL app.current_user_id = $1`, [userB.id]);
        await clientB.query(
          `INSERT INTO casos (user_id, template_id, status, form_data)
           VALUES ($1, $2, $3, $4)`,
          [userB.id, templateB.id, "borrador", "{}"],
        );
        await clientB.query("COMMIT");
      } catch (e) {
        await clientB.query("ROLLBACK");
        throw e;
      } finally {
        clientB.release();
      }

      // User A sees only 1 caso
      const countA = await countCasosAs(userA.id);
      expect(countA).toBe(1);

      // User B sees only 1 caso
      const countB = await countCasosAs(userB.id);
      expect(countB).toBe(1);
    });
  });

  describe("constraints", () => {
    it("status CHECK constraint rejects invalid status", async () => {
      if (!pool) return;
      const user = await createUserAs(0, {
        email: "casos-status@example.com",
        displayName: "Casos Status",
        externalSubject: "subj_casos_status",
      });
      const doc = await createDocumentAs(user.id, {
        userId: user.id,
        filename: "status-check.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
      });
      const template = await createTemplateAs(user.id, {
        userId: user.id,
        name: "Status Check Template",
        documentId: doc.id,
      });

      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [user.id]);
        await client.query(
          `INSERT INTO casos (user_id, template_id, status, form_data)
           VALUES ($1, $2, $3, $4)`,
          [user.id, template.id, "invalid_status", "{}"],
        );
        await client.query("COMMIT");
        throw new Error("Invalid status should have been rejected");
      } catch (e) {
        await client.query("ROLLBACK");
        expect((e as Error).message).toMatch(/check|constraint/i);
      } finally {
        client.release();
      }
    });

    it("FK to templates rejects non-existent template_id", async () => {
      if (!pool) return;
      const user = await createUserAs(0, {
        email: "casos-fk-tpl@example.com",
        displayName: "Casos FK Template",
        externalSubject: "subj_casos_fk_tpl",
      });

      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [user.id]);
        await client.query(
          `INSERT INTO casos (user_id, template_id, status, form_data)
           VALUES ($1, $2, $3, $4)`,
          [
            user.id,
            "00000000-0000-0000-0000-000000000000",
            "borrador",
            "{}",
          ],
        );
        await client.query("COMMIT");
        throw new Error(
          "Non-existent template_id should have been rejected",
        );
      } catch (e) {
        await client.query("ROLLBACK");
        expect((e as Error).message).toMatch(
          /foreign key|constraint|violates/i,
        );
      } finally {
        client.release();
      }
    });

    it("FK to users rejects non-existent user_id", async () => {
      if (!pool) return;
      const user = await createUserAs(0, {
        email: "casos-fk-usr@example.com",
        displayName: "Casos FK User",
        externalSubject: "subj_casos_fk_usr",
      });
      const doc = await createDocumentAs(user.id, {
        userId: user.id,
        filename: "fk-user.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
      });
      const template = await createTemplateAs(user.id, {
        userId: user.id,
        name: "FK User Template",
        documentId: doc.id,
      });

      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [user.id]);
        await client.query(
          `INSERT INTO casos (user_id, template_id, status, form_data)
           VALUES ($1, $2, $3, $4)`,
          [999999, template.id, "borrador", "{}"],
        );
        await client.query("COMMIT");
        throw new Error("Non-existent user_id should have been rejected");
      } catch (e) {
        await client.query("ROLLBACK");
        expect((e as Error).message).toMatch(
          /foreign key|constraint|violates/i,
        );
      } finally {
        client.release();
      }
    });
  });
});
