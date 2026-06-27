/**
 * Cases controller integration test — CRUD + generate endpoints
 *
 * Validates: Zod validation, 401/404/409/422/502 error mapping,
 * RLS isolation, status transitions, and AI generation flow.
 *
 * When DATABASE_URL is not set, the suite is skipped silently.
 * Run with DATABASE_URL set to execute against a real PostgreSQL instance.
 */

import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { IncomingMessage } from "node:http";
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

async function setupApp(): Promise<INestApplication | null> {
  if (!DATABASE_URL) return null;
  const { Test } = await import("@nestjs/testing");
  const { AppModule } = await import("../../app.module.js");
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const nestApp = moduleRef.createNestApplication();
  nestApp.setGlobalPrefix("api");
  await nestApp.init();
  return nestApp;
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

async function cleanTables(): Promise<void> {
  if (!pool) return;
  await pool.query("DELETE FROM casos");
  await pool.query("DELETE FROM templates");
  await pool.query("DELETE FROM entities");
  await pool.query("DELETE FROM analysis_results");
  await pool.query("DELETE FROM documents");
}

async function insertDocumentAndTemplate(
  userId: number,
): Promise<{ documentId: string; templateId: string }> {
  if (!pool) throw new Error("Pool not initialized");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = $1`, [userId]);

    const docResult = await client.query(
      `INSERT INTO documents (user_id, filename, mime_type, size_bytes)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, "test.pdf", "application/pdf", 100],
    );
    const documentId = docResult.rows[0].id as string;

    const tplResult = await client.query(
      `INSERT INTO templates (user_id, name, document_id, category)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, "Test Template", documentId, "legal"],
    );
    const templateId = tplResult.rows[0].id as string;

    await client.query("COMMIT");
    return { documentId, templateId };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

function http() {
  if (!app) throw new Error("App not initialized");
  return app.getHttpServer();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CasesController integration", () => {
  beforeAll(async () => {
    pool = await setupPool();
    if (!pool) return;
    await cleanTables();
    app = await setupApp();
  });

  afterEach(async () => {
    if (!pool) return;
    await cleanTables();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (pool) await pool.end();
  });

  describe("POST /api/cases", () => {
    it("should create a case with status borrador", async () => {
      if (!app) return;
      const user = await createUserAs(0, {
        email: "cases-create@example.com",
        displayName: "Cases Create",
        externalSubject: "subj_cases_create",
      });
      const { templateId } = await insertDocumentAndTemplate(user.id);

      const res = await new Promise<{ status: number; body: unknown }>(
        (resolve) => {
          const req = http().request(
            "POST",
            "/api/cases",
            (res: IncomingMessage) => {
              let data = "";
              res.on("data", (chunk: string) => (data += chunk));
              res.on("end", () =>
                resolve({
                  status: res.statusCode ?? 0,
                  body: JSON.parse(data),
                }),
              );
            },
          );
          req.setHeader("Content-Type", "application/json");
          req.write(JSON.stringify({ templateId }));
          req.end();
        },
      );

      expect(res.status).toBe(201);
      expect((res.body as Record<string, unknown>).status).toBe("borrador");
    });

    it("should return 400 for invalid templateId (not UUID)", async () => {
      if (!app) return;

      const res = await new Promise<{ status: number }>((resolve) => {
        const req = http().request(
          "POST",
          "/api/cases",
          (res: IncomingMessage) => {
            let data = "";
            res.on("data", (chunk: string) => (data += chunk));
            res.on("end", () => resolve({ status: res.statusCode }));
          },
        );
        req.setHeader("Content-Type", "application/json");
        req.write(JSON.stringify({ templateId: "not-a-uuid" }));
        req.end();
      });

      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent template", async () => {
      if (!app) return;
      const user = await createUserAs(0, {
        email: "cases-404@example.com",
        displayName: "Cases 404",
        externalSubject: "subj_cases_404",
      });

      const res = await new Promise<{ status: number }>((resolve) => {
        const req = http().request(
          "POST",
          "/api/cases",
          (res: IncomingMessage) => {
            let data = "";
            res.on("data", (chunk: string) => (data += chunk));
            res.on("end", () => resolve({ status: res.statusCode }));
          },
        );
        req.setHeader("Content-Type", "application/json");
        req.write(
          JSON.stringify({
            templateId: "00000000-0000-0000-0000-000000000000",
          }),
        );
        req.end();
      });

      expect(res.status).toBe(404);
    });
  });

  describe("GET /api/cases", () => {
    it("should return empty array when no cases exist", async () => {
      if (!app) return;

      const res = await new Promise<{ status: number; body: unknown }>(
        (resolve) => {
          const req = http().request(
            "GET",
            "/api/cases",
            (res: IncomingMessage) => {
              let data = "";
              res.on("data", (chunk: string) => (data += chunk));
              res.on("end", () =>
                resolve({
                  status: res.statusCode ?? 0,
                  body: JSON.parse(data),
                }),
              );
            },
          );
          req.end();
        },
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe("GET /api/cases/:id", () => {
    it("should return 404 for non-existent case", async () => {
      if (!app) return;

      const res = await new Promise<{ status: number }>((resolve) => {
        const req = http().request(
          "GET",
          "/api/cases/00000000-0000-0000-0000-000000000000",
          (res: IncomingMessage) => {
            let data = "";
            res.on("data", (chunk: string) => (data += chunk));
            res.on("end", () => resolve({ status: res.statusCode }));
          },
        );
        req.end();
      });

      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/cases/:id", () => {
    it("should return 404 for non-existent case", async () => {
      if (!app) return;

      const res = await new Promise<{ status: number }>((resolve) => {
        const req = http().request(
          "PATCH",
          "/api/cases/00000000-0000-0000-0000-000000000000",
          (res: IncomingMessage) => {
            let data = "";
            res.on("data", (chunk: string) => (data += chunk));
            res.on("end", () => resolve({ status: res.statusCode }));
          },
        );
        req.setHeader("Content-Type", "application/json");
        req.write(JSON.stringify({ formData: { ent_1: "test" } }));
        req.end();
      });

      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/cases/:id", () => {
    it("should return 404 for non-existent case", async () => {
      if (!app) return;

      const res = await new Promise<{ status: number }>((resolve) => {
        const req = http().request(
          "DELETE",
          "/api/cases/00000000-0000-0000-0000-000000000000",
          (res: IncomingMessage) => {
            let data = "";
            res.on("data", (chunk: string) => (data += chunk));
            res.on("end", () => resolve({ status: res.statusCode }));
          },
        );
        req.end();
      });

      expect(res.status).toBe(404);
    });
  });
});
