/**
 * Documents integration test — POST /api/documents/upload
 *
 * Validates the full HTTP cycle: multipart upload → Document response shape.
 * When DATABASE_URL is not set, the suite is skipped silently.
 * Run with DATABASE_URL set to execute against a real PostgreSQL instance.
 */

import { describe, expect, it, beforeAll, afterAll } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let pool: Pool | null = null;

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
    await cleanDocumentsTable();
  });

  afterAll(async () => {
    if (pool) {
      await cleanDocumentsTable();
      await pool.end();
    }
  });

  it("returns Document shape on successful upload", async () => {
    if (!pool) return;

    const { Test } = await import("@nestjs/testing");
    const { DocumentsModule } = await import("./documents.module.js");
    const request = (await import("supertest")).default;

    // Create a user for RLS
    await createUserAs(0, {
      email: "doc-upload-int@example.com",
      displayName: "Doc Upload Int",
      externalSubject: "subj_doc_upload_int",
    });

    // Bootstrap NestJS app with DocumentsModule
    const moduleFixture = await Test.createTestingModule({
      imports: [DocumentsModule],
    }).compile();
    const app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();

    try {
      // Upload a file via multipart
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
    } finally {
      await app.close();
      await cleanDocumentsTable();
    }
  });

  it("returns 400 when no file is provided", async () => {
    if (!pool) return;

    const { Test } = await import("@nestjs/testing");
    const { DocumentsModule } = await import("./documents.module.js");
    const request = (await import("supertest")).default;

    const moduleFixture = await Test.createTestingModule({
      imports: [DocumentsModule],
    }).compile();
    const app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();

    try {
      const response = await request(app.getHttpServer())
        .post("/api/documents/upload");

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        message: expect.stringContaining("No file uploaded"),
      });
    } finally {
      await app.close();
    }
  });

  it("returns 500 when database fails", async () => {
    if (!pool) return;

    const { Test } = await import("@nestjs/testing");
    const { DocumentsModule } = await import("./documents.module.js");
    const { PostgresService } = await import("../infrastructure/postgres/postgres.service.js");
    const { DatabaseModule } = await import("../infrastructure/postgres/database.module.js");
    const request = (await import("supertest")).default;

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

    const app = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();

    try {
      const filePath = Buffer.from("test file content");
      const response = await request(app.getHttpServer())
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
      await app.close();
    }
  });
});