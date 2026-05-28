import { describe, expect, it, vi, beforeEach } from "vitest";
import { ConflictException } from "@nestjs/common";
import { TemplatesService } from "./templates.service";
import { PostgresService, type TransactionContext } from "../infrastructure/postgres/postgres.service";
import type { TemplateRecord } from "../infrastructure/postgres/repositories/templates.repository";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTemplateRecord(overrides: Partial<TemplateRecord> = {}): TemplateRecord {
  return {
    id: "tmpl-uuid-1",
    userId: 0,
    name: "Contrato de Arrendamiento",
    description: "Standard lease agreement template",
    documentId: "doc-uuid-1",
    category: "legal",
    status: "draft",
    entities: [],
    createdAt: new Date("2025-01-15T10:30:00Z"),
    ...overrides,
  };
}

function createMockPostgresService(setup: {
  templateRecords?: TemplateRecord[];
  createdRecord?: TemplateRecord;
  existingByName?: TemplateRecord | null;
}): { mockPostgres: PostgresService; mockClient: { query: ReturnType<typeof vi.fn> } } {
  const { templateRecords = [], createdRecord, existingByName = null } = setup;

  const mockClient = { query: vi.fn() };

  mockClient.query.mockImplementation((sql: string) => {
    // Transaction control
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return Promise.resolve({ rowCount: 0, rows: [] });
    }
    if (sql.includes("SET LOCAL")) {
      return Promise.resolve({ rowCount: 0, rows: [] });
    }

    // SELECT templates by userId (list)
    if (sql.includes("SELECT") && sql.includes("FROM templates") && sql.includes("WHERE user_id =")) {
      return Promise.resolve({
        rowCount: templateRecords.length,
        rows: templateRecords.map((r) => ({
          id: r.id,
          user_id: r.userId,
          name: r.name,
          description: r.description,
          document_id: r.documentId,
          category: r.category,
          status: r.status,
          // pg driver parses JSONB to JS objects — simulate that
          entities: r.entities,
          created_at: r.createdAt,
        })),
      });
    }

    // SELECT template by name + userId (uniqueness check)
    if (sql.includes("SELECT") && sql.includes("FROM templates") && sql.includes("WHERE name =") && sql.includes("AND user_id =")) {
      if (existingByName === null) {
        return Promise.resolve({ rowCount: 0, rows: [] });
      }
      return Promise.resolve({
        rowCount: 1,
        rows: [{
          id: existingByName.id,
          user_id: existingByName.userId,
          name: existingByName.name,
          description: existingByName.description,
          document_id: existingByName.documentId,
          category: existingByName.category,
          status: existingByName.status,
          // pg driver parses JSONB to JS objects
          entities: existingByName.entities,
          created_at: existingByName.createdAt,
        }],
      });
    }

    // INSERT INTO templates (create)
    if (sql.includes("INSERT INTO templates")) {
      const record = createdRecord ?? makeTemplateRecord();
      return Promise.resolve({
        rowCount: 1,
        rows: [{
          id: record.id,
          user_id: record.userId,
          name: record.name,
          description: record.description,
          document_id: record.documentId,
          category: record.category,
          status: record.status,
          // pg driver parses JSONB to JS objects on read
          entities: record.entities,
          created_at: record.createdAt,
        }],
      });
    }

    return Promise.resolve({ rowCount: 0, rows: [] });
  });

  const mockPostgres = {
    withOwnerTransaction: vi.fn(
      async (ownerId: number, cb: (ctx: TransactionContext) => Promise<unknown>) => {
        await mockClient.query("BEGIN");
        await mockClient.query(`SET LOCAL app.current_user_id = $1`, [ownerId]);
        const result = await cb({ client: mockClient as never, ownerId });
        await mockClient.query("COMMIT");
        return result;
      },
    ),
  } as unknown as PostgresService;

  return { mockPostgres, mockClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TemplatesService", () => {
  describe("list", () => {
    it("should return all templates for a given userId", async () => {
      const records = [
        makeTemplateRecord({ id: "tmpl-1", name: "Template A", userId: 0 }),
        makeTemplateRecord({ id: "tmpl-2", name: "Template B", userId: 0 }),
      ];

      const { mockPostgres } = createMockPostgresService({ templateRecords: records });
      const service = new TemplatesService(mockPostgres);

      const result = await service.list(0);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Template A");
      expect(result[1].name).toBe("Template B");
    });

    it("should return an empty array when no templates exist for userId", async () => {
      const { mockPostgres } = createMockPostgresService({ templateRecords: [] });
      const service = new TemplatesService(mockPostgres);

      const result = await service.list(0);

      expect(result).toEqual([]);
    });

    it("should map TemplateRecord fields to TemplateResponse shape", async () => {
      const record = makeTemplateRecord({
        id: "tmpl-uuid-1",
        userId: 0,
        name: "Contrato de Arrendamiento",
        description: "A standard lease",
        documentId: "doc-uuid-1",
        category: "legal",
        status: "draft",
        entities: [{ id: "entity-1", label: "LOCADOR", value: "J Pérez", group: "PARTES", confidence: "ALTA", sourceSpan: null, reviewed: false, excluded: false }],
        createdAt: new Date("2025-01-15T10:30:00Z"),
      });

      const { mockPostgres } = createMockPostgresService({ templateRecords: [record] });
      const service = new TemplatesService(mockPostgres);

      const result = await service.list(0);

      expect(result[0]).toEqual({
        id: "tmpl-uuid-1",
        name: "Contrato de Arrendamiento",
        description: "A standard lease",
        documentId: "doc-uuid-1",
        category: "legal",
        status: "draft",
        entities: [{ id: "entity-1", label: "LOCADOR", value: "J Pérez", group: "PARTES", confidence: "ALTA", sourceSpan: null, reviewed: false, excluded: false }],
        createdAt: "2025-01-15T10:30:00.000Z",
      });
    });
  });

  describe("create", () => {
    it("should insert a template with JSONB entities and return it with id and createdAt", async () => {
      const createdRecord = makeTemplateRecord({
        id: "new-uuid",
        name: "Contrato de Arrendamiento",
        createdAt: new Date("2025-02-01T12:00:00Z"),
        entities: [
          { id: "entity-1", label: "COMPRADOR", value: "María López", group: "PARTES", confidence: "ALTA", sourceSpan: null, reviewed: false, excluded: false },
        ],
      });

      const { mockPostgres, mockClient } = createMockPostgresService({
        existingByName: null,
        createdRecord,
      });
      const service = new TemplatesService(mockPostgres);

      const result = await service.create({
        name: "Contrato de Arrendamiento",
        description: "Standard lease agreement template",
        documentId: "doc-uuid-1",
        entities: [
          { id: "entity-1", label: "COMPRADOR", value: "María López", group: "PARTES", confidence: "ALTA", sourceSpan: null, reviewed: false, excluded: false },
        ],
        category: "legal",
        status: "draft",
      });

      expect(result.id).toBe("new-uuid");
      expect(result.createdAt).toBe("2025-02-01T12:00:00.000Z");
      expect(result.name).toBe("Contrato de Arrendamiento");

      // Verify insert was called within a transaction
      expect(mockPostgres.withOwnerTransaction).toHaveBeenCalledWith(0, expect.any(Function));
    });

    it("should throw ConflictException when a template with the same name already exists for the user", async () => {
      const existingRecord = makeTemplateRecord({ name: "Duplicate Name" });

      // Override the mock to make the uniqueness check find an existing template
      const mockClient = { query: vi.fn() };
      mockClient.query.mockImplementation((sql: string) => {
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK" || sql.includes("SET LOCAL")) {
          return Promise.resolve({ rowCount: 0, rows: [] });
        }
        // findByNameAndUserId returns existing template
        if (sql.includes("SELECT") && sql.includes("FROM templates") && sql.includes("WHERE name =") && sql.includes("AND user_id =")) {
          return Promise.resolve({
            rowCount: 1,
            rows: [{
              id: existingRecord.id,
              user_id: existingRecord.userId,
              name: existingRecord.name,
              description: existingRecord.description,
              document_id: existingRecord.documentId,
              category: existingRecord.category,
              status: existingRecord.status,
              entities: JSON.stringify(existingRecord.entities),
              created_at: existingRecord.createdAt,
            }],
          });
        }
        return Promise.resolve({ rowCount: 0, rows: [] });
      });

      const mockPostgres = {
        withOwnerTransaction: vi.fn(
          async (ownerId: number, cb: (ctx: TransactionContext) => Promise<unknown>) => {
            await mockClient.query("BEGIN");
            await mockClient.query(`SET LOCAL app.current_user_id = $1`, [ownerId]);
            const result = await cb({ client: mockClient as never, ownerId });
            await mockClient.query("COMMIT");
            return result;
          },
        ),
      } as unknown as PostgresService;

      const service = new TemplatesService(mockPostgres);

      await expect(
        service.create({
          name: "Duplicate Name",
          description: "Should conflict",
          documentId: "doc-uuid-1",
          entities: [],
          category: "legal",
          status: "draft",
        }),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.create({
          name: "Duplicate Name",
          description: "Should conflict",
          documentId: "doc-uuid-1",
          entities: [],
          category: "legal",
          status: "draft",
        }),
      ).rejects.toThrow("A template with this name already exists");
    });

    it("should store entities as JSONB snapshot when creating a template", async () => {
      const entities = [
        { id: "entity-1", label: "INMUEBLE", value: "Calle 123", group: "INMUEBLE" as const, confidence: "ALTA" as const, sourceSpan: { start: 10, end: 25 }, reviewed: false, excluded: false },
      ];

      const createdRecord = makeTemplateRecord({
        id: "tmpl-entities",
        entities: entities,
        createdAt: new Date("2025-03-01T09:00:00Z"),
      });

      const mockClient = { query: vi.fn() };
      let insertCalled = false;

      mockClient.query.mockImplementation((sql: string, params?: unknown[]) => {
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK" || sql.includes("SET LOCAL")) {
          return Promise.resolve({ rowCount: 0, rows: [] });
        }
        // findByNameAndUserId returns null
        if (sql.includes("SELECT") && sql.includes("FROM templates") && sql.includes("WHERE name =")) {
          return Promise.resolve({ rowCount: 0, rows: [] });
        }
        // INSERT INTO templates
        if (sql.includes("INSERT INTO templates")) {
          insertCalled = true;
          // Verify entities are passed as JSON string (JSONB)
          expect(params).toBeDefined();
          expect(params![5]).toBe(JSON.stringify(entities));

          return Promise.resolve({
            rowCount: 1,
            rows: [{
              id: createdRecord.id,
              user_id: createdRecord.userId,
              name: createdRecord.name,
              description: createdRecord.description,
              document_id: createdRecord.documentId,
              category: createdRecord.category,
              status: createdRecord.status,
              entities: JSON.stringify(createdRecord.entities),
              created_at: createdRecord.createdAt,
            }],
          });
        }
        return Promise.resolve({ rowCount: 0, rows: [] });
      });

      const mockPostgres = {
        withOwnerTransaction: vi.fn(
          async (ownerId: number, cb: (ctx: TransactionContext) => Promise<unknown>) => {
            await mockClient.query("BEGIN");
            await mockClient.query(`SET LOCAL app.current_user_id = $1`, [ownerId]);
            const result = await cb({ client: mockClient as never, ownerId });
            await mockClient.query("COMMIT");
            return result;
          },
        ),
      } as unknown as PostgresService;

      const service = new TemplatesService(mockPostgres);

      await service.create({
        name: "Entity Template",
        description: "Test JSONB entities",
        documentId: "doc-uuid-1",
        entities,
        category: "legal",
        status: "draft",
      });

      expect(insertCalled).toBe(true);
    });
  });
});