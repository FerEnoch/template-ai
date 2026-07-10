/**
 * 0015-0017 migrations — Integration tests for ai-inference-upgrade foundation
 *
 * Validates: group CHECK widened to non-empty, reviewed_at column + partial index,
 * templates.suggested_groups_status JSONB column.
 *
 * When DATABASE_URL is not set, the suite is skipped silently.
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

async function cleanTables(): Promise<void> {
  if (!pool) return;
  await pool.query("DELETE FROM entities");
  await pool.query("DELETE FROM analysis_results");
  await pool.query("DELETE FROM templates");
  await pool.query("DELETE FROM documents");
}

async function runMigrations(): Promise<void> {
  if (!pool || !DATABASE_URL) return;
  const { runMigrations } = await import("./migrate.js");
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

async function createDocumentAs(
  ownerId: number,
  data: { userId: number; filename: string; mimeType: string; sizeBytes: number },
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

describe("0015-0017 ai-inference-upgrade foundation", () => {
  beforeAll(async () => {
    pool = await setupPool();
    if (!pool) return;
    await cleanTables();
    await runMigrations();
  });

  afterEach(async () => {
    if (!pool) return;
    await cleanTables();
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  describe("0015 entities group dynamic", () => {
    it("allows GENERAL group", async () => {
      if (!pool) return;
      const user = await createUserAs(0, {
        email: "general-group@example.com",
        displayName: "General Group",
        externalSubject: "subj_general",
      });
      const doc = await createDocumentAs(user.id, {
        userId: user.id,
        filename: "general.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
      });

      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [user.id]);
        const arResult = await client.query(
          `INSERT INTO analysis_results (document_id, status)
           VALUES ($1, $2) RETURNING id`,
          [doc.id, "processing"],
        );
        const analysisId = arResult.rows[0].id as string;
        await client.query(
          `INSERT INTO entities (analysis_result_id, document_id, label, value, "group", confidence)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [analysisId, doc.id, "Test", "Value", "GENERAL", "ALTA"],
        );
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    });

    it("allows dynamic group", async () => {
      if (!pool) return;
      const user = await createUserAs(0, {
        email: "dynamic-group@example.com",
        displayName: "Dynamic Group",
        externalSubject: "subj_dynamic",
      });
      const doc = await createDocumentAs(user.id, {
        userId: user.id,
        filename: "dynamic.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
      });

      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [user.id]);
        const arResult = await client.query(
          `INSERT INTO analysis_results (document_id, status)
           VALUES ($1, $2) RETURNING id`,
          [doc.id, "processing"],
        );
        const analysisId = arResult.rows[0].id as string;
        await client.query(
          `INSERT INTO entities (analysis_result_id, document_id, label, value, "group", confidence)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [analysisId, doc.id, "Test", "Value", "JORNADA", "ALTA"],
        );
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }
    });

    it("rejects empty group", async () => {
      if (!pool) return;
      const user = await createUserAs(0, {
        email: "empty-group@example.com",
        displayName: "Empty Group",
        externalSubject: "subj_empty",
      });
      const doc = await createDocumentAs(user.id, {
        userId: user.id,
        filename: "empty.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
      });

      const p = requirePool();
      const client = await p.connect();
      let analysisId: string;
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [user.id]);
        const arResult = await client.query(
          `INSERT INTO analysis_results (document_id, status)
           VALUES ($1, $2) RETURNING id`,
          [doc.id, "processing"],
        );
        analysisId = arResult.rows[0].id as string;
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }

      const client2 = await p.connect();
      try {
        await client2.query("BEGIN");
        await client2.query(`SET LOCAL app.current_user_id = $1`, [user.id]);
        await client2.query(
          `INSERT INTO entities (analysis_result_id, document_id, label, value, "group", confidence)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [analysisId, doc.id, "Test", "Value", "", "ALTA"],
        );
        await client2.query("COMMIT");
        throw new Error("Empty group should have been rejected");
      } catch (e) {
        await client2.query("ROLLBACK");
        expect((e as Error).message).toMatch(/check|constraint/i);
      } finally {
        client2.release();
      }
    });
  });

  describe("0016 entities reviewed_at", () => {
    it("has reviewed_at column", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'entities' AND table_schema = 'public' AND column_name = 'reviewed_at'`,
      );
      expect(result.rowCount).toBe(1);
    });

    it("has partial index on reviewed_at", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'entities_reviewed_at_idx'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });

  describe("0017 templates suggested_groups_status", () => {
    it("has suggested_groups_status column", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'templates' AND table_schema = 'public' AND column_name = 'suggested_groups_status'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });
});
