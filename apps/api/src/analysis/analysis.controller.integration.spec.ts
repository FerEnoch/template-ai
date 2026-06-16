/**
 * Analysis integration test — GET /api/analysis/:id and GET /api/analysis/:id/status
 *
 * Validates the full HTTP cycle: poll progression → completed with entities.
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

async function cleanAnalysisTables(): Promise<void> {
  if (!pool) return;
  await pool.query("DELETE FROM entities");
  await pool.query("DELETE FROM analysis_results");
  await pool.query("DELETE FROM documents");
}

async function insertDocumentAndResult(
  filename: string,
  mimeType: string,
  sizeBytes: number,
): Promise<{ documentId: string; analysisResultId: string }> {
  if (!pool) throw new Error("Pool not initialized");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = $1`, [0]);

    const docResult = await client.query(
      `INSERT INTO documents (user_id, filename, mime_type, size_bytes, status)
       VALUES ($1, $2, $3, $4, 'processing')
       RETURNING id`,
      [0, filename, mimeType, sizeBytes],
    );

    const analysisResult = await client.query(
      `INSERT INTO analysis_results (document_id, status, progress)
       VALUES ($1, 'processing', 0)
       RETURNING id`,
      [docResult.rows[0].id],
    );

    await client.query("COMMIT");
    return {
      documentId: docResult.rows[0].id as string,
      analysisResultId: analysisResult.rows[0].id as string,
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

describe("Analysis integration: GET /api/analysis/:id", () => {
  beforeAll(async () => {
    if (!DATABASE_URL) return;
    pool = await setupPool();
    if (!pool) return;

    // Bootstrap NestJS app ONCE — shared across all tests
    const { Test } = await import("@nestjs/testing");
    const { AnalysisModule } = await import("./analysis.module.js");
    const { DocumentsModule } = await import("../documents/documents.module.js");

    const moduleFixture = await Test.createTestingModule({
      imports: [AnalysisModule, DocumentsModule],
    }).compile();
    app = moduleFixture.createNestApplication({ logger: false });
    app.setGlobalPrefix("api");
    await app.init();

    await cleanAnalysisTables();
  });

  afterEach(async () => {
    if (pool) await cleanAnalysisTables();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    if (pool) {
      await cleanAnalysisTables();
      await pool.end();
      pool = null;
    }
  });

  it("increments progress on each poll and completes with entities after 4 calls", async () => {
    if (!pool || !app) return;

    const request = (await import("supertest")).default;

    await createUserAs(0, {
      email: "analysis-int@example.com",
      displayName: "Analysis Int",
      externalSubject: "subj_analysis_int",
    });

    const { documentId } = await insertDocumentAndResult(
      "test-contract.pdf",
      "application/pdf",
      1024,
    );

    // Poll 1: progress should be ~25
    const res1 = await request(app.getHttpServer()).get(`/api/analysis/${documentId}`);
    expect(res1.status).toBe(200);
    expect(res1.body.progress).toBe(25);
    expect(res1.body.status).toBe("processing");
    expect(res1.body.documentId).toBe(documentId);
    expect(res1.body.entities).toEqual([]);

    // Poll 2: progress should be ~50
    const res2 = await request(app.getHttpServer()).get(`/api/analysis/${documentId}`);
    expect(res2.status).toBe(200);
    expect(res2.body.progress).toBe(50);
    expect(res2.body.status).toBe("processing");

    // Poll 3: progress should be ~75
    const res3 = await request(app.getHttpServer()).get(`/api/analysis/${documentId}`);
    expect(res3.status).toBe(200);
    expect(res3.body.progress).toBe(75);
    expect(res3.body.status).toBe("processing");

    // Poll 4: progress reaches 100 → status "completed" with entities
    const res4 = await request(app.getHttpServer()).get(`/api/analysis/${documentId}`);
    expect(res4.status).toBe(200);
    expect(res4.body.progress).toBe(100);
    expect(res4.body.status).toBe("completed");
    expect(res4.body.completedAt).toBeTruthy();
    expect(res4.body.entities.length).toBe(11);

    // Verify entity groups: PARTES (2), INMUEBLE (5), FECHAS (2), ANEXOS (2)
    const groups = (res4.body.entities as Array<{ group: string }>).reduce(
      (acc, e) => {
        acc[e.group] = (acc[e.group] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
    expect(groups.PARTES).toBe(2);
    expect(groups.INMUEBLE).toBe(5);
    expect(groups.FECHAS).toBe(2);
    expect(groups.ANEXOS).toBe(2);

    // Poll 5: idempotent — returns completed without re-inserting
    const res5 = await request(app.getHttpServer()).get(`/api/analysis/${documentId}`);
    expect(res5.status).toBe(200);
    expect(res5.body.status).toBe("completed");
    expect(res5.body.progress).toBe(100);
    expect(res5.body.entities.length).toBe(11);
  });

  it("returns 404 for nonexistent document ID", async () => {
    if (!pool || !app) return;

    const request = (await import("supertest")).default;

    const response = await request(app.getHttpServer()).get(
      "/api/analysis/00000000-0000-0000-0000-000000000000",
    );
    expect(response.status).toBe(404);
  });

  it("GET /:id/status returns lightweight response without entities", async () => {
    if (!pool || !app) return;

    const request = (await import("supertest")).default;

    await createUserAs(0, {
      email: "analysis-status-int@example.com",
      displayName: "Analysis Status Int",
      externalSubject: "subj_analysis_status_int",
    });

    const { documentId } = await insertDocumentAndResult(
      "status-test.pdf",
      "application/pdf",
      2048,
    );

    const response = await request(app.getHttpServer()).get(
      `/api/analysis/${documentId}/status`,
    );
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      documentId,
      status: expect.any(String),
      progress: expect.any(Number),
    });
    // Lightweight response should NOT have entities, startedAt, or completedAt
    expect(response.body.entities).toBeUndefined();
    expect(response.body.startedAt).toBeUndefined();
    expect(response.body.completedAt).toBeUndefined();
  });
});
