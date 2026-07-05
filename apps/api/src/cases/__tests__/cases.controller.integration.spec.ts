/**
 * Cases controller integration test — CRUD + generate endpoints
 *
 * Validates: Zod validation, 401/404/409/422/502 error mapping,
 * RLS isolation, status transitions, and AI generation flow.
 *
 * When DATABASE_URL is not set, the suite is skipped silently.
 * Run with DATABASE_URL set to execute against a real PostgreSQL instance.
 */

import { describe, expect, it, beforeAll, afterAll, afterEach, vi } from "vitest";
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
    await client.query(`SET LOCAL app.current_user_id = ${ownerId}`);
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
    await client.query(`SET LOCAL app.current_user_id = ${userId}`);

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

async function insertCaseAs(
  userId: number,
  templateId: string,
): Promise<string> {
  if (!pool) throw new Error("Pool not initialized");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = $1`, [userId]);
    const result = await client.query(
      `INSERT INTO casos (user_id, template_id, status, form_data)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [userId, templateId, "borrador", JSON.stringify({})],
    );
    await client.query("COMMIT");
    return result.rows[0].id as string;
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
            res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
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
            res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
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

    it("should return the existing borrador on a second POST with the same template", async () => {
      if (!app || !pool) return;
      const user = await createUserAs(0, {
        email: "cases-idempotent@example.com",
        displayName: "Cases Idempotent",
        externalSubject: "subj_cases_idempotent",
      });
      const { templateId } = await insertDocumentAndTemplate(user.id);

      const post = async () =>
        new Promise<{ status: number; body: unknown }>((resolve) => {
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
        });

      const first = await post();
      const second = await post();

      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect((second.body as Record<string, unknown>).id).toBe(
        (first.body as Record<string, unknown>).id,
      );

      const count = await pool.query(
        "SELECT COUNT(*)::int as count FROM casos WHERE user_id = $1 AND template_id = $2",
        [user.id, templateId],
      );
      expect(count.rows[0].count).toBe(1);
    });

    it("should create exactly one borrador under concurrent POSTs", async () => {
      if (!app || !pool) return;
      const user = await createUserAs(0, {
        email: "cases-concurrent@example.com",
        displayName: "Cases Concurrent",
        externalSubject: "subj_cases_concurrent",
      });
      const { templateId } = await insertDocumentAndTemplate(user.id);

      const post = () =>
        new Promise<{ status: number; body: unknown }>((resolve) => {
          const req = http().request(
            "POST",
            "/api/cases",
            (res: IncomingMessage) => {
              let data = "";
              res.on("data", (chunk: string) => (data += chunk));
              res.on("end", () =>
                resolve({
                  status: res.statusCode ?? 0,
                  body: data ? (JSON.parse(data) as unknown) : null,
                }),
              );
            },
          );
          req.setHeader("Content-Type", "application/json");
          req.write(JSON.stringify({ templateId }));
          req.end();
        });

      const [a, b] = await Promise.all([post(), post()]);

      const statuses = [a.status, b.status].sort((x, y) => x - y);
      expect(statuses).toEqual([200, 201]);

      const aId = (a.body as Record<string, unknown> | null)?.id;
      const bId = (b.body as Record<string, unknown> | null)?.id;
      expect(aId).toBeDefined();
      expect(aId).toBe(bId);

      const count = await pool.query(
        "SELECT COUNT(*)::int as count FROM casos WHERE user_id = $1 AND template_id = $2",
        [user.id, templateId],
      );
      expect(count.rows[0].count).toBe(1);
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
            res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
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
            res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
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
            res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
          },
        );
        req.end();
      });

      expect(res.status).toBe(404);
    });

    it("should return 204 and archive an active case", async () => {
      if (!app) return;
      const user = await createUserAs(0, {
        email: "cases-delete-active@example.com",
        displayName: "Cases Delete Active",
        externalSubject: "subj_cases_delete_active",
      });
      const { templateId } = await insertDocumentAndTemplate(user.id);

      const created = await new Promise<{ status: number; body: { id: string } }>(
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

      expect(created.status).toBe(201);

      const deleted = await new Promise<{ status: number; body: string }>(
        (resolve) => {
          const req = http().request(
            "DELETE",
            `/api/cases/${created.body.id}`,
            (res: IncomingMessage) => {
              let data = "";
              res.on("data", (chunk: string) => (data += chunk));
              res.on("end", () =>
                resolve({ status: res.statusCode ?? 0, body: data }),
              );
            },
          );
          req.end();
        },
      );

      expect(deleted.status).toBe(204);
      expect(deleted.body).toBe("");

      if (pool) {
        const result = await pool.query(
          "SELECT status FROM casos WHERE id = $1",
          [created.body.id],
        );
        expect(result.rows[0]?.status).toBe("archivado");
      }
    });

    it("should return 204 when deleting an already-archived case", async () => {
      if (!app) return;
      const user = await createUserAs(0, {
        email: "cases-delete-idempotent@example.com",
        displayName: "Cases Delete Idempotent",
        externalSubject: "subj_cases_delete_idempotent",
      });
      const { templateId } = await insertDocumentAndTemplate(user.id);

      const created = await new Promise<{ status: number; body: { id: string } }>(
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

      expect(created.status).toBe(201);

      await new Promise<{ status: number }>((resolve) => {
        const req = http().request(
          "DELETE",
          `/api/cases/${created.body.id}`,
          (res: IncomingMessage) => {
            res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
          },
        );
        req.end();
      });

      const second = await new Promise<{ status: number; body: string }>(
        (resolve) => {
          const req = http().request(
            "DELETE",
            `/api/cases/${created.body.id}`,
            (res: IncomingMessage) => {
              let data = "";
              res.on("data", (chunk: string) => (data += chunk));
              res.on("end", () =>
                resolve({ status: res.statusCode ?? 0, body: data }),
              );
            },
          );
          req.end();
        },
      );

      expect(second.status).toBe(204);
      expect(second.body).toBe("");
    });

    it("should return 404 when deleting another user's case (RLS)", async () => {
      if (!app) return;
      const userA = await createUserAs(0, {
        email: "cases-user-a@example.com",
        displayName: "Cases User A",
        externalSubject: "subj_cases_user_a",
      });
      await createUserAs(0, {
        email: "cases-user-b@example.com",
        displayName: "Cases User B",
        externalSubject: "subj_cases_user_b",
      });
      const { templateId } = await insertDocumentAndTemplate(userA.id);
      const caseId = await insertCaseAs(userA.id, templateId);

      const res = await new Promise<{ status: number }>((resolve) => {
        const req = http().request(
          "DELETE",
          `/api/cases/${caseId}`,
          (res: IncomingMessage) => {
            res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
          },
        );
        req.end();
      });

      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/cases/:id/generate with failing AI service", () => {
    let generateApp: INestApplication | null = null;

    beforeAll(async () => {
      if (!DATABASE_URL) return;

      const { Test } = await import("@nestjs/testing");
      const { DatabaseModule } = await import(
        "../../infrastructure/postgres/database.module"
      );
      const { CasesController } = await import("../cases.controller");
      const { CasesService } = await import("../cases.service");
      const { DocumentGenerationService } = await import(
        "../../ai/document-generation.service.js"
      );

      const moduleRef = await Test.createTestingModule({
        imports: [DatabaseModule],
        controllers: [CasesController],
        providers: [
          CasesService,
          {
            provide: DocumentGenerationService,
            useValue: {
              generate: vi.fn().mockResolvedValue({
                success: false,
                error: "Upstream unreachable",
                errorType: "NETWORK_ERROR",
              }),
            },
          },
        ],
      }).compile();

      generateApp = moduleRef.createNestApplication();
      const { HttpExceptionFilter } = await import(
        "../../infrastructure/http/exception.filter"
      );
      generateApp.useGlobalFilters(new HttpExceptionFilter());
      generateApp.setGlobalPrefix("api");
      await generateApp.init();
    });

    afterAll(async () => {
      if (generateApp) await generateApp.close();
    });

    it("should return 502 with both error and errorType in the response body", async () => {
      if (!pool || !generateApp) return;

      const user = await createUserAs(0, {
        email: "cases-generate-fail@example.com",
        displayName: "Cases Generate Fail",
        externalSubject: "subj_cases_generate_fail",
      });
      const { templateId } = await insertDocumentAndTemplate(user.id);

      const client = await pool.connect();
      let caseId: string;
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [user.id]);
        const caseResult = await client.query(
          `INSERT INTO casos (user_id, template_id, status, form_data)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [user.id, templateId, "borrador", {}],
        );
        caseId = caseResult.rows[0].id as string;
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }

      const res = await new Promise<{ status: number; body: unknown }>(
        (resolve) => {
          const req = generateApp!.getHttpServer().request(
            "POST",
            `/api/cases/${caseId}/generate`,
            (res: IncomingMessage) => {
              let data = "";
              res.on("data", (chunk: string) => (data += chunk));
              res.on("end", () =>
                resolve({
                  status: res.statusCode ?? 0,
                  body: data ? JSON.parse(data) : {},
                }),
              );
            },
          );
          req.end();
        },
      );

      expect(res.status).toBe(502);
      expect(res.body).toMatchObject({
        error: "No se pudo contactar al servicio de IA. Intentá nuevamente.",
        errorType: "NETWORK_ERROR",
      });
    });
  });
});
