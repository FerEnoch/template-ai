/**
 * Review integration test — POST /api/review/:documentId/entities/:entityId
 *
 * Validates the full HTTP cycle: update entity fields (reviewed, value, excluded),
 * verify 404 on missing entity.
 * When DATABASE_URL is not set, the suite is skipped silently.
 */

import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let pool: Pool | null = null;
let app: INestApplication | null = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupPool(): Promise<Pool | null> {
  if (!DATABASE_URL) return null;
  const { Pool: PgPool } = await import("pg");
  const p = new PgPool({ connectionString: DATABASE_URL });
  try {
    await p.query("SELECT 1");
    return p;
  } catch {
    await p.end();
    return null;
  }
}

async function createUserAs(
  ownerId: number,
  data: { email: string; displayName: string; externalSubject: string },
): Promise<{ id: number }> {
  if (!pool) throw new Error("Pool not initialized");
  const client = await pool.connect();
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

async function cleanReviewTables(): Promise<void> {
  if (!pool) return;
  await pool.query("DELETE FROM entities");
  await pool.query("DELETE FROM analysis_results");
  await pool.query("DELETE FROM documents");
}

async function insertDocumentAnalysisAndEntity(): Promise<{
  documentId: string;
  entityId: string;
}> {
  if (!pool) throw new Error("Pool not initialized");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = $1`, [0]);

    const docResult = await client.query(
      `INSERT INTO documents (user_id, filename, mime_type, size_bytes, status)
       VALUES ($1, $2, $3, $4, 'completed')
       RETURNING id`,
      [0, "review-test.pdf", "application/pdf", 2048],
    );

    const analysisResult = await client.query(
      `INSERT INTO analysis_results (document_id, status, progress)
       VALUES ($1, 'completed', 100)
       RETURNING id`,
      [docResult.rows[0].id],
    );

    const entityResult = await client.query(
      `INSERT INTO entities (analysis_result_id, document_id, label, value, "group", confidence, source_span, reviewed, excluded)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        analysisResult.rows[0].id,
        docResult.rows[0].id,
        "COMPRADOR",
        "María González López",
        "PARTES",
        "ALTA",
        JSON.stringify({ start: 142, end: 163 }),
        false,
        false,
      ],
    );

    await client.query("COMMIT");
    return {
      documentId: docResult.rows[0].id as string,
      entityId: entityResult.rows[0].id as string,
    };
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

describe("Review integration: POST /api/review/:documentId/entities/:entityId", () => {
  beforeAll(async () => {
    if (!DATABASE_URL) return;
    pool = await setupPool();
    if (!pool) return;

    // Bootstrap NestJS app ONCE — shared across all tests
    const { Test } = await import("@nestjs/testing");
    const { ReviewModule } = await import("./review.module.js");
    const { DocumentsModule } = await import("../documents/documents.module.js");
    const { AnalysisModule } = await import("../analysis/analysis.module.js");

    const moduleFixture = await Test.createTestingModule({
      imports: [ReviewModule, DocumentsModule, AnalysisModule],
    }).compile();
    app = moduleFixture.createNestApplication({ logger: false });
    app.setGlobalPrefix("api");
    await app.init();

    await cleanReviewTables();
  });

  afterEach(async () => {
    if (pool) await cleanReviewTables();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    if (pool) {
      await cleanReviewTables();
      await pool.end();
      pool = null;
    }
  });

  it("updates entity reviewed and value fields, returns updated entity", async () => {
    if (!pool || !app) return;

    const request = (await import("supertest")).default;

    await createUserAs(0, {
      email: "review-int@example.com",
      displayName: "Review Int",
      externalSubject: "subj_review_int",
    });

    const { documentId, entityId } = await insertDocumentAnalysisAndEntity();

    const res = await request(app.getHttpServer())
      .post(`/api/review/${documentId}/entities/${entityId}`)
      .send({ reviewed: true, value: "Juan Pérez" });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(entityId);
    expect(res.body.reviewed).toBe(true);
    expect(res.body.value).toBe("Juan Pérez");
    expect(res.body.excluded).toBe(false);
  });

  it("updates entity excluded field only", async () => {
    if (!pool || !app) return;

    const request = (await import("supertest")).default;

    await createUserAs(0, {
      email: "review-exclude@example.com",
      displayName: "Review Exclude",
      externalSubject: "subj_review_exclude",
    });

    const { documentId, entityId } = await insertDocumentAnalysisAndEntity();

    const res = await request(app.getHttpServer())
      .post(`/api/review/${documentId}/entities/${entityId}`)
      .send({ excluded: true });

    expect(res.status).toBe(201);
    expect(res.body.excluded).toBe(true);
    expect(res.body.reviewed).toBe(false);
  });

  it("returns 404 for non-existent entity", async () => {
    if (!pool || !app) return;

    const request = (await import("supertest")).default;

    const res = await request(app.getHttpServer())
      .post("/api/review/00000000-0000-0000-0000-000000000000/entities/00000000-0000-0000-0000-000000000000")
      .send({ reviewed: true });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Entity not found");
  });
});
