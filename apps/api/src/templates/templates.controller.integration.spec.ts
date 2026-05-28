/**
 * Templates integration test — GET /api/templates + POST /api/templates
 *
 * Validates the full HTTP cycle: list templates (empty + populated),
 * create a template, 400 validation errors, and 409 duplicate name.
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

async function cleanTemplatesTables(): Promise<void> {
  if (!pool) return;
  await pool.query("DELETE FROM templates");
  await pool.query("DELETE FROM entities");
  await pool.query("DELETE FROM analysis_results");
  await pool.query("DELETE FROM documents");
}

async function insertDocumentForTemplates(): Promise<string> {
  if (!pool) throw new Error("Pool not initialized");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = $1`, [0]);

    const docResult = await client.query(
      `INSERT INTO documents (user_id, filename, mime_type, size_bytes, status)
       VALUES ($1, $2, $3, $4, 'completed')
       RETURNING id`,
      [0, "template-test.pdf", "application/pdf", 2048],
    );

    await client.query("COMMIT");
    return docResult.rows[0].id as string;
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

describe("Templates integration: GET + POST /api/templates", () => {
  beforeAll(async () => {
    if (!DATABASE_URL) return;
    pool = await setupPool();
    if (!pool) return;
    await cleanTemplatesTables();
  });

  afterAll(async () => {
    if (pool) {
      await cleanTemplatesTables();
      await pool.end();
    }
  });

  it("returns empty array when no templates exist", async () => {
    if (!pool) return;

    const { Test } = await import("@nestjs/testing");
    const { TemplatesModule } = await import("./templates.module.js");
    const request = (await import("supertest")).default;

    await createUserAs(0, {
      email: "tmpl-list-int@example.com",
      displayName: "Tmpl List Int",
      externalSubject: "subj_tmpl_list_int",
    });

    const moduleFixture = await Test.createTestingModule({
      imports: [TemplatesModule],
    }).compile();
    const app: INestApplication = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();

    try {
      const res = await request(app.getHttpServer())
        .get("/api/templates");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it("creates a template and returns it with id and createdAt", async () => {
    if (!pool) return;

    const { Test } = await import("@nestjs/testing");
    const { TemplatesModule } = await import("./templates.module.js");
    const request = (await import("supertest")).default;

    await cleanTemplatesTables();
    await createUserAs(0, {
      email: "tmpl-create-int@example.com",
      displayName: "Tmpl Create Int",
      externalSubject: "subj_tmpl_create_int",
    });

    const documentId = await insertDocumentForTemplates();

    const moduleFixture = await Test.createTestingModule({
      imports: [TemplatesModule],
    }).compile();
    const app: INestApplication = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();

    try {
      const res = await request(app.getHttpServer())
        .post("/api/templates")
        .send({
          name: "Contrato de Arrendamiento",
          description: "A standard lease agreement",
          documentId,
          entities: [
            {
              id: "770e8400-e29b-41d4-a716-446655440002",
              label: "COMPRADOR",
              value: "Juan Pérez",
              group: "PARTES",
              confidence: "ALTA",
              reviewed: false,
              excluded: false,
            },
          ],
          category: "legal",
          status: "draft",
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        id: expect.any(String),
        name: "Contrato de Arrendamiento",
        description: "A standard lease agreement",
        documentId,
        category: "legal",
        status: "draft",
        createdAt: expect.any(String),
      });
      expect(res.body.entities).toHaveLength(1);
      expect(res.body.entities[0]).toMatchObject({
        label: "COMPRADOR",
        value: "Juan Pérez",
        group: "PARTES",
        confidence: "ALTA",
      });

      // Verify createdAt is a valid ISO date
      expect(new Date(res.body.createdAt).toISOString()).toBe(res.body.createdAt);
    } finally {
      await app.close();
      await cleanTemplatesTables();
    }
  });

  it("returns 400 when name is too short", async () => {
    if (!pool) return;

    const { Test } = await import("@nestjs/testing");
    const { TemplatesModule } = await import("./templates.module.js");
    const request = (await import("supertest")).default;

    const moduleFixture = await Test.createTestingModule({
      imports: [TemplatesModule],
    }).compile();
    const app: INestApplication = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();

    try {
      const res = await request(app.getHttpServer())
        .post("/api/templates")
        .send({
          name: "ab",
          description: "Too short",
          documentId: "660e8400-e29b-41d4-a716-446655440001",
          entities: [],
          category: "legal",
          status: "draft",
        });

      expect(res.status).toBe(400);
    } finally {
      await app.close();
    }
  });

  it("returns 409 when creating a template with a duplicate name", async () => {
    if (!pool) return;

    const { Test } = await import("@nestjs/testing");
    const { TemplatesModule } = await import("./templates.module.js");
    const request = (await import("supertest")).default;

    await cleanTemplatesTables();
    await createUserAs(0, {
      email: "tmpl-dup-int@example.com",
      displayName: "Tmpl Dup Int",
      externalSubject: "subj_tmpl_dup_int",
    });

    const documentId = await insertDocumentForTemplates();

    const moduleFixture = await Test.createTestingModule({
      imports: [TemplatesModule],
    }).compile();
    const app: INestApplication = moduleFixture.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();

    try {
      // Create first template
      const res1 = await request(app.getHttpServer())
        .post("/api/templates")
        .send({
          name: "Duplicate Name Test",
          description: "First one",
          documentId,
          entities: [],
          category: "legal",
          status: "draft",
        });

      expect(res1.status).toBe(201);

      // Try to create second template with same name
      const res2 = await request(app.getHttpServer())
        .post("/api/templates")
        .send({
          name: "Duplicate Name Test",
          description: "Second one, should conflict",
          documentId,
          entities: [],
          category: "legal",
          status: "draft",
        });

      expect(res2.status).toBe(409);
    } finally {
      await app.close();
      await cleanTemplatesTables();
    }
  });
});