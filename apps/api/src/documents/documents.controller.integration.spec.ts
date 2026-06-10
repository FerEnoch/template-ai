/**
 * Documents integration test — POST /api/documents/upload
 *
 * Validates the full HTTP cycle: multipart upload → Document response shape.
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

async function cleanDocumentsTable(): Promise<void> {
  if (!pool) return;
  await pool.query("DELETE FROM entities");
  await pool.query("DELETE FROM analysis_results");
  await pool.query("DELETE FROM documents");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Documents integration: POST /api/documents/upload", () => {
  beforeAll(async () => {
    if (!DATABASE_URL) return;
    pool = await setupPool();
    if (!pool) return;

    // Bootstrap NestJS app ONCE — shared across all tests
    const { Test } = await import("@nestjs/testing");
    const { DocumentsModule } = await import("./documents.module.js");

    const moduleFixture = await Test.createTestingModule({
      imports: [DocumentsModule],
    }).compile();
    app = moduleFixture.createNestApplication({ logger: false });
    app.setGlobalPrefix("api");
    await app.init();

    await cleanDocumentsTable();
  });

  afterEach(async () => {
    if (pool) await cleanDocumentsTable();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    if (pool) {
      await cleanDocumentsTable();
      await pool.end();
      pool = null;
    }
  });

  it("returns Document shape on successful upload", async () => {
    if (!pool || !app) return;

    const request = (await import("supertest")).default;

    await createUserAs(0, {
      email: "doc-upload-int@example.com",
      displayName: "Doc Upload Int",
      externalSubject: "subj_doc_upload_int",
    });

    const filePath = Buffer.from("test file content");
    const response = await request(app.getHttpServer())
      .post("/api/documents/upload")
      .attach("file", filePath, {
        filename: "test-contract.pdf",
        contentType: "application/pdf",
      });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      id: expect.any(String),
      filename: "test-contract.pdf",
      mimeType: "application/pdf",
      sizeBytes: expect.any(Number),
      status: "processing",
      uploadedAt: expect.any(String),
    });

    // Verify the uploadedAt is a valid ISO date
    expect(new Date(response.body.uploadedAt).toISOString()).toBe(response.body.uploadedAt);
  });

  it("returns 400 when no file is provided", async () => {
    if (!pool || !app) return;

    const request = (await import("supertest")).default;

    const response = await request(app.getHttpServer())
      .post("/api/documents/upload");

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      message: expect.stringContaining("No file uploaded"),
    });
  });

  it("returns 500 when database fails", async () => {
    if (!pool || !app) return;

    const { Test } = await import("@nestjs/testing");
    const { DocumentsModule } = await import("./documents.module.js");
    const { PostgresService } = await import("../infrastructure/postgres/postgres.service.js");
    const { DatabaseModule } = await import("../infrastructure/postgres/database.module.js");
    const request = (await import("supertest")).default;

    // This test must create its own app because it overrides providers
    const moduleFixture = await Test.createTestingModule({
      imports: [DocumentsModule, DatabaseModule],
    })
      .overrideProvider(PostgresService)
      .useValue({
        ready: async () => true,
        withOwnerTransaction: async () => {
          throw new Error("DB connection failed");
        },
      })
      .compile();

    const errorApp = moduleFixture.createNestApplication({ logger: false });
    errorApp.setGlobalPrefix("api");
    await errorApp.init();

    try {
      const filePath = Buffer.from("test file content");
      const response = await request(errorApp.getHttpServer())
        .post("/api/documents/upload")
        .attach("file", filePath, {
          filename: "broken.pdf",
          contentType: "application/pdf",
        });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        message: expect.stringContaining("Internal server error during file upload"),
      });
    } finally {
      await errorApp.close();
    }
  });
});
