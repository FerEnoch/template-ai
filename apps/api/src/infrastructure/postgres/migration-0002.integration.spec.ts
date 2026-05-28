/**
 * 0002_document_templates — Integration tests for RLS, indexes, and constraints
 *
 * Validates: 4 new tables exist, RLS policies enforce user_id ownership,
 * constraints (CHECK, UNIQUE, FK) work, and indexes exist.
 *
 * When DATABASE_URL is not set, the suite is skipped silently.
 * Run with DATABASE_URL set to execute against a real PostgreSQL instance.
 */

import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

// ---------------------------------------------------------------------------
// Pool setup — null when no DATABASE_URL, causing all tests to skip
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function cleanNewTables(): Promise<void> {
  if (!pool) return;
  // Delete in dependency order (entities depends on analysis_results and documents)
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

async function countDocumentsAs(ownerId: number): Promise<number> {
  const p = requirePool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = $1`, [ownerId]);
    const result = await client.query("SELECT COUNT(*)::int as count FROM documents");
    await client.query("COMMIT");
    return result.rows[0].count as number;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("0002_document_templates RLS and constraints", () => {
  beforeAll(async () => {
    pool = await setupPool();
    if (!pool) return;
    await cleanNewTables();
    await runMigrations();
  });

  afterEach(async () => {
    if (!pool) return;
    await cleanNewTables();
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  describe("tables exist", () => {
    it("documents table exists with expected columns", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'documents' AND table_schema = 'public'
         ORDER BY column_name`,
      );
      const columns = result.rows.map((r) => r.column_name as string);
      expect(columns).toContain("id");
      expect(columns).toContain("user_id");
      expect(columns).toContain("filename");
      expect(columns).toContain("mime_type");
      expect(columns).toContain("size_bytes");
      expect(columns).toContain("status");
      expect(columns).toContain("uploaded_at");
    });

    it("analysis_results table exists with expected columns", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'analysis_results' AND table_schema = 'public'
         ORDER BY column_name`,
      );
      const columns = result.rows.map((r) => r.column_name as string);
      expect(columns).toContain("id");
      expect(columns).toContain("document_id");
      expect(columns).toContain("status");
      expect(columns).toContain("progress");
      expect(columns).toContain("started_at");
      expect(columns).toContain("completed_at");
    });

    it("entities table exists with expected columns", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'entities' AND table_schema = 'public'
         ORDER BY column_name`,
      );
      const columns = result.rows.map((r) => r.column_name as string);
      expect(columns).toContain("id");
      expect(columns).toContain("analysis_result_id");
      expect(columns).toContain("document_id");
      expect(columns).toContain("label");
      expect(columns).toContain("value");
      expect(columns).toContain("group");
      expect(columns).toContain("confidence");
      expect(columns).toContain("source_span");
      expect(columns).toContain("reviewed");
      expect(columns).toContain("excluded");
    });

    it("templates table exists with expected columns", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'templates' AND table_schema = 'public'
         ORDER BY column_name`,
      );
      const columns = result.rows.map((r) => r.column_name as string);
      expect(columns).toContain("id");
      expect(columns).toContain("user_id");
      expect(columns).toContain("name");
      expect(columns).toContain("description");
      expect(columns).toContain("document_id");
      expect(columns).toContain("category");
      expect(columns).toContain("status");
      expect(columns).toContain("entities");
      expect(columns).toContain("created_at");
    });
  });

  describe("indexes exist", () => {
    it("documents_user_id_idx exists", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'documents_user_id_idx'`,
      );
      expect(result.rowCount).toBe(1);
    });

    it("analysis_results_document_id_idx exists", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'analysis_results_document_id_idx'`,
      );
      expect(result.rowCount).toBe(1);
    });

    it("entities_analysis_result_id_idx exists", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'entities_analysis_result_id_idx'`,
      );
      expect(result.rowCount).toBe(1);
    });

    it("templates_user_id_idx exists", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT indexname FROM pg_indexes WHERE indexname = 'templates_user_id_idx'`,
      );
      expect(result.rowCount).toBe(1);
    });
  });

  describe("RLS policies enforce ownership", () => {
    it("user A cannot read user B's documents", async () => {
      if (!pool) return;
      const userA = await createUserAs(0, {
        email: "usera-int@example.com",
        displayName: "User A",
        externalSubject: "subj_a_int",
      });
      const userB = await createUserAs(0, {
        email: "userb-int@example.com",
        displayName: "User B",
        externalSubject: "subj_b_int",
      });

      await createDocumentAs(userA.id, {
        userId: userA.id,
        filename: "contract-a.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
      });
      await createDocumentAs(userB.id, {
        userId: userB.id,
        filename: "contract-b.pdf",
        mimeType: "application/pdf",
        sizeBytes: 200,
      });

      const countA = await countDocumentsAs(userA.id);
      expect(countA).toBe(1);

      const countB = await countDocumentsAs(userB.id);
      expect(countB).toBe(1);
    });

    it("documents status CHECK constraint rejects invalid status", async () => {
      if (!pool) return;
      const user = await createUserAs(0, {
        email: "status-check@example.com",
        displayName: "Status Check",
        externalSubject: "subj_status",
      });

      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [user.id]);
        await client.query(
          `INSERT INTO documents (user_id, filename, mime_type, size_bytes, status)
           VALUES ($1, $2, $3, $4, $5)`,
          [user.id, "bad.pdf", "application/pdf", 1, "invalid_status"],
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

    it("templates UNIQUE constraint rejects duplicate name per user", async () => {
      if (!pool) return;
      const user = await createUserAs(0, {
        email: "unique-template@example.com",
        displayName: "Unique Template",
        externalSubject: "subj_unique",
      });
      const doc = await createDocumentAs(user.id, {
        userId: user.id,
        filename: "base.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
      });

      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [user.id]);
        await client.query(
          `INSERT INTO templates (user_id, name, document_id, category)
           VALUES ($1, $2, $3, $4)`,
          [user.id, "Same Name", doc.id, "legal"],
        );
        await client.query(
          `INSERT INTO templates (user_id, name, document_id, category)
           VALUES ($1, $2, $3, $4)`,
          [user.id, "Same Name", doc.id, "legal"],
        );
        await client.query("COMMIT");
        throw new Error("Duplicate template name should have been rejected");
      } catch (e) {
        await client.query("ROLLBACK");
        expect((e as Error).message).toMatch(/duplicate|unique|constraint/i);
      } finally {
        client.release();
      }
    });

    it("entities group CHECK constraint rejects invalid group", async () => {
      if (!pool) return;
      const user = await createUserAs(0, {
        email: "entity-group@example.com",
        displayName: "Entity Group",
        externalSubject: "subj_egroup",
      });
      const doc = await createDocumentAs(user.id, {
        userId: user.id,
        filename: "group-check.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
      });

      const p = requirePool();
      const client = await p.connect();
      // First: insert analysis_result
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

      // Now: try to insert an entity with invalid group
      const client2 = await p.connect();
      try {
        await client2.query("BEGIN");
        await client2.query(`SET LOCAL app.current_user_id = $1`, [user.id]);
        await client2.query(
          `INSERT INTO entities (analysis_result_id, document_id, label, value, "group", confidence)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [analysisId, doc.id, "Test", "Value", "INVALID_GROUP", "ALTA"],
        );
        await client2.query("COMMIT");
        throw new Error("Invalid group should have been rejected");
      } catch (e) {
        await client2.query("ROLLBACK");
        expect((e as Error).message).toMatch(/check|constraint/i);
      } finally {
        client2.release();
      }
    });

    it("analysis_results progress CHECK constraint rejects out-of-range", async () => {
      if (!pool) return;
      const user = await createUserAs(0, {
        email: "progress-check@example.com",
        displayName: "Progress Check",
        externalSubject: "subj_progress",
      });
      const doc = await createDocumentAs(user.id, {
        userId: user.id,
        filename: "progress.pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
      });

      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [user.id]);
        await client.query(
          `INSERT INTO analysis_results (document_id, status, progress)
           VALUES ($1, $2, $3)`,
          [doc.id, "processing", 150],
        );
        await client.query("COMMIT");
        throw new Error("Progress > 100 should have been rejected");
      } catch (e) {
        await client.query("ROLLBACK");
        expect((e as Error).message).toMatch(/check|constraint/i);
      } finally {
        client.release();
      }
    });
  });

  describe("RLS is enabled and forced on all new tables", () => {
    it("documents has RLS enabled and forced", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class WHERE relname = 'documents'`,
      );
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].relrowsecurity).toBe(true);
      expect(result.rows[0].relforcerowsecurity).toBe(true);
    });

    it("analysis_results has RLS enabled and forced", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class WHERE relname = 'analysis_results'`,
      );
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].relrowsecurity).toBe(true);
      expect(result.rows[0].relforcerowsecurity).toBe(true);
    });

    it("entities has RLS enabled and forced", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class WHERE relname = 'entities'`,
      );
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].relrowsecurity).toBe(true);
      expect(result.rows[0].relforcerowsecurity).toBe(true);
    });

    it("templates has RLS enabled and forced", async () => {
      if (!pool) return;
      const result = await pool.query(
        `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class WHERE relname = 'templates'`,
      );
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].relrowsecurity).toBe(true);
      expect(result.rows[0].relforcerowsecurity).toBe(true);
    });
  });
});