import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotFoundException, ForbiddenException } from "@nestjs/common";

// Mock AI config before importing service (OpenRouterService triggers env loading)
vi.mock("../config/ai.js", () => ({
  AI_CONFIG: {
    model: "test-model",
    modelFallback: undefined,
    apiKey: "test-api-key",
    maxTokens: 8192,
    temperature: 0.1,
  },
  UPLOAD_DIR: "/tmp/test-uploads",
}));

vi.mock("../config/env.js", () => ({
  getApiEnv: () => ({
    PORT: 3000,
    OPENROUTER_API_KEY: "test-key",
    DATABASE_URL: "postgresql://test",
    AUTH0_DOMAIN: "test.auth0.com",
    AUTH0_AUDIENCE: "test-audience",
  }),
}));

import { ReviewService } from "./review.service";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { OpenRouterService, OpenRouterError } from "../ai/open-router.service";
import type { EntityRecord } from "../infrastructure/postgres/repositories/entities.repository";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntityRecord(overrides: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id: "entity-uuid-1",
    analysisResultId: "analysis-uuid-1",
    documentId: "doc-uuid-1",
    label: "COMPRADOR",
    value: "María González López",
    group: "PARTES",
    confidence: "ALTA",
    sourceSpan: { start: 142, end: 163 },
    reviewed: false,
    excluded: false,
    userCreated: false,
    ...overrides,
  };
}

function createMockPostgresService(setup: {
  entityRecord?: EntityRecord | null;
  updatedRecord?: EntityRecord | null;
  createdRecord?: EntityRecord | null;
  manualEntityCount?: number;
}): PostgresService {
  const { entityRecord = null, updatedRecord, createdRecord, manualEntityCount = 0 } = setup;

  const mockClient = {
    query: vi.fn((sql: string, _params?: unknown[]) => {
      // RLS session variable
      if (sql.includes("SET LOCAL")) {
        return Promise.resolve({ rowCount: 0, rows: [] });
      }
      // BEGIN/COMMIT/ROLLBACK
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return Promise.resolve({ rowCount: 0, rows: [] });
      }

      // COUNT user_created entities
      if (sql.includes("COUNT(*)") && sql.includes("user_created")) {
        return Promise.resolve({
          rowCount: 1,
          rows: [{ count: String(manualEntityCount) }],
        });
      }

      // SELECT analysis_results (findByDocumentId)
      if (sql.includes("FROM analysis_results") && sql.includes("WHERE document_id")) {
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              id: "analysis-uuid-1",
              document_id: "doc-1",
              status: "completed",
              progress: 100,
            },
          ],
        });
      }

      // SELECT entities (findById)
      if (sql.includes("SELECT") && sql.includes("FROM entities") && sql.includes("WHERE id =")) {
        if (entityRecord === null) {
          return Promise.resolve({ rowCount: 0, rows: [] });
        }
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              id: entityRecord.id,
              analysis_result_id: entityRecord.analysisResultId,
              document_id: entityRecord.documentId,
              label: entityRecord.label,
              value: entityRecord.value,
              group: entityRecord.group,
              confidence: entityRecord.confidence,
              source_span: entityRecord.sourceSpan ?? null,
              reviewed: entityRecord.reviewed,
              excluded: entityRecord.excluded,
              user_created: entityRecord.userCreated,
            },
          ],
        });
      }

      // INSERT entities
      if (sql.includes("INSERT INTO entities")) {
        const record = createdRecord ?? entityRecord;
        if (record === null) {
          return Promise.resolve({ rowCount: 0, rows: [] });
        }
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              id: record.id,
              analysis_result_id: record.analysisResultId,
              document_id: record.documentId,
              label: record.label,
              value: record.value,
              group: record.group,
              confidence: record.confidence,
              source_span: record.sourceSpan ?? null,
              reviewed: record.reviewed,
              excluded: record.excluded,
              user_created: record.userCreated,
            },
          ],
        });
      }

      // UPDATE entities
      if (sql.includes("UPDATE entities")) {
        const record = updatedRecord ?? entityRecord;
        if (record === null) {
          return Promise.resolve({ rowCount: 0, rows: [] });
        }
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              id: record.id,
              analysis_result_id: record.analysisResultId,
              document_id: record.documentId,
              label: record.label,
              value: record.value,
              group: record.group,
              confidence: record.confidence,
              source_span: record.sourceSpan ?? null,
              reviewed: record.reviewed,
              excluded: record.excluded,
              user_created: record.userCreated,
            },
          ],
        });
      }

      return Promise.resolve({ rowCount: 0, rows: [] });
    }),
  };

  const mockPostgres = {
    withOwnerTransaction: vi.fn(
      async (_ownerId: number, cb: (ctx: { client: unknown; ownerId: number }) => Promise<unknown>) => {
        await mockClient.query("BEGIN");
        await mockClient.query("SET LOCAL app.current_user_id = $1", [_ownerId]);
        const result = await cb({ client: mockClient as never, ownerId: _ownerId });
        await mockClient.query("COMMIT");
        return result;
      },
    ),
  } as unknown as PostgresService;

  return mockPostgres;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReviewService", () => {
  let mockOpenRouter: OpenRouterService;

  beforeEach(() => {
    mockOpenRouter = {
      classifySpan: vi.fn(),
    } as unknown as OpenRouterService;
  });

  describe("updateEntity", () => {
    it("should find entity by ID, merge partial update, and return updated entity", async () => {
      const existingRecord = makeEntityRecord({
        id: "entity-1",
        documentId: "doc-1",
        reviewed: false,
        value: "Original Value",
        excluded: false,
      });
      const updatedRecord = makeEntityRecord({
        id: "entity-1",
        documentId: "doc-1",
        reviewed: true,
        value: "Updated Value",
        excluded: false,
      });

      const mockPostgres = createMockPostgresService({
        entityRecord: existingRecord,
        updatedRecord,
      });
      const service = new ReviewService(mockPostgres, mockOpenRouter);

      const result = await service.updateEntity("doc-1", "entity-1", {
        reviewed: true,
        value: "Updated Value",
      });

      expect(result.id).toBe("entity-1");
      expect(result.reviewed).toBe(true);
      expect(result.value).toBe("Updated Value");
      expect(result.excluded).toBe(false);
    });

    it("should throw NotFoundException when entity is not found", async () => {
      const mockPostgres = createMockPostgresService({
        entityRecord: null,
      });
      const service = new ReviewService(mockPostgres, mockOpenRouter);

      await expect(
        service.updateEntity("doc-1", "nonexistent-id", { reviewed: true }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.updateEntity("doc-1", "nonexistent-id", { reviewed: true }),
      ).rejects.toThrow("Entity not found");
    });

    it("should update only excluded field when only excluded is provided", async () => {
      const existingRecord = makeEntityRecord({
        id: "entity-2",
        documentId: "doc-2",
        excluded: false,
      });
      const updatedRecord = makeEntityRecord({
        id: "entity-2",
        documentId: "doc-2",
        excluded: true,
      });

      const mockPostgres = createMockPostgresService({
        entityRecord: existingRecord,
        updatedRecord,
      });
      const service = new ReviewService(mockPostgres, mockOpenRouter);

      const result = await service.updateEntity("doc-2", "entity-2", {
        excluded: true,
      });

      expect(result.excluded).toBe(true);
      expect(result.reviewed).toBe(false); // unchanged
      expect(result.value).toBe("María González López"); // original value preserved
    });

    it("should update all three fields (reviewed, value, excluded) at once", async () => {
      const existingRecord = makeEntityRecord({
        id: "entity-3",
        documentId: "doc-3",
        reviewed: false,
        value: "Old Value",
        excluded: false,
      });
      const updatedRecord = makeEntityRecord({
        id: "entity-3",
        documentId: "doc-3",
        reviewed: true,
        value: "New Value",
        excluded: true,
      });

      const mockPostgres = createMockPostgresService({
        entityRecord: existingRecord,
        updatedRecord,
      });
      const service = new ReviewService(mockPostgres, mockOpenRouter);

      const result = await service.updateEntity("doc-3", "entity-3", {
        reviewed: true,
        value: "New Value",
        excluded: true,
      });

      expect(result.reviewed).toBe(true);
      expect(result.value).toBe("New Value");
      expect(result.excluded).toBe(true);
    });

    it("should preserve sourceSpan in updated entity", async () => {
      const existingRecord = makeEntityRecord({
        id: "entity-4",
        documentId: "doc-4",
        sourceSpan: { start: 100, end: 200 },
      });
      const updatedRecord = makeEntityRecord({
        id: "entity-4",
        documentId: "doc-4",
        sourceSpan: { start: 100, end: 200 },
        reviewed: true,
      });

      const mockPostgres = createMockPostgresService({
        entityRecord: existingRecord,
        updatedRecord,
      });
      const service = new ReviewService(mockPostgres, mockOpenRouter);

      const result = await service.updateEntity("doc-4", "entity-4", {
        reviewed: true,
      });

      expect(result.sourceSpan).toEqual({ start: 100, end: 200 });
    });

    // FIX 3: documentId must match the entity's document — prevents cross-document updates
    it("should throw NotFoundException when documentId does not match entity's document (FIX 3)", async () => {
      // Entity belongs to "doc-1" but the request uses "doc-attacker"
      const existingRecord = makeEntityRecord({
        id: "entity-1",
        documentId: "doc-1", // entity is owned by doc-1
      });

      const updatedRecord = makeEntityRecord({
        id: "entity-1",
        documentId: "doc-1",
        reviewed: true,
      });

      const mockPostgres = createMockPostgresService({
        entityRecord: existingRecord,
        updatedRecord,
      });
      const service = new ReviewService(mockPostgres, mockOpenRouter);

      // Attacker tries to update entity-1 via a different documentId
      await expect(
        service.updateEntity("doc-attacker", "entity-1", { reviewed: true }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.updateEntity("doc-attacker", "entity-1", { reviewed: true }),
      ).rejects.toThrow("Entity not found");
    });

    it("should allow update when documentId matches entity's document (FIX 3 triangulation)", async () => {
      const existingRecord = makeEntityRecord({
        id: "entity-1",
        documentId: "doc-1",
        reviewed: false,
      });
      const updatedRecord = makeEntityRecord({
        id: "entity-1",
        documentId: "doc-1",
        reviewed: true,
      });

      const mockPostgres = createMockPostgresService({
        entityRecord: existingRecord,
        updatedRecord,
      });
      const service = new ReviewService(mockPostgres, mockOpenRouter);

      const result = await service.updateEntity("doc-1", "entity-1", { reviewed: true });

      expect(result.reviewed).toBe(true);
      expect(result.id).toBe("entity-1");
    });
  });

  describe("classifySpan", () => {
    it("should classify a span and return label, group, value", async () => {
      const mockPostgres = createMockPostgresService({
        manualEntityCount: 0,
      });

      vi.spyOn(mockOpenRouter, "classifySpan").mockResolvedValue({
        label: "ARRENDATARIO",
        group: "PARTES",
        value: "Juan Pérez",
      });

      const service = new ReviewService(mockPostgres, mockOpenRouter);

      const result = await service.classifySpan("doc-1", {
        text: "Juan Pérez",
        sourceSpan: { start: 34, end: 44 },
        context: "...entre Juan Pérez y María López...",
      });

      expect(result.label).toBe("ARRENDATARIO");
      expect(result.group).toBe("PARTES");
      expect(result.value).toBe("Juan Pérez");
      expect(mockOpenRouter.classifySpan).toHaveBeenCalledWith(
        "Juan Pérez",
        "...entre Juan Pérez y María López...",
      );
    });

    it("should throw ForbiddenException when manual entity limit is reached", async () => {
      const mockPostgres = createMockPostgresService({
        manualEntityCount: 5,
      });

      const service = new ReviewService(mockPostgres, mockOpenRouter);

      await expect(
        service.classifySpan("doc-1", {
          text: "Juan Pérez",
          sourceSpan: { start: 34, end: 44 },
          context: "context",
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.classifySpan("doc-1", {
          text: "Juan Pérez",
          sourceSpan: { start: 34, end: 44 },
          context: "context",
        }),
      ).rejects.toThrow("MANUAL_ENTITY_LIMIT_REACHED");
    });

    it("should retry once on network error", async () => {
      const mockPostgres = createMockPostgresService({
        manualEntityCount: 0,
      });

      vi.spyOn(mockOpenRouter, "classifySpan")
        .mockRejectedValueOnce(new OpenRouterError("Connection refused", "NETWORK_ERROR"))
        .mockResolvedValueOnce({
          label: "COMPRADOR",
          group: "PARTES",
          value: "Juan Pérez",
        });

      const service = new ReviewService(mockPostgres, mockOpenRouter);

      const result = await service.classifySpan("doc-1", {
        text: "Juan Pérez",
        sourceSpan: { start: 0, end: 10 },
        context: "context",
      });

      expect(result.label).toBe("COMPRADOR");
      expect(mockOpenRouter.classifySpan).toHaveBeenCalledTimes(2);
    });
  });

  describe("createEntity", () => {
    it("should create a manual entity with userCreated: true", async () => {
      const createdRecord = makeEntityRecord({
        id: "new-entity-1",
        documentId: "doc-1",
        label: "CAMPO_CUSTOM",
        value: "Valor Custom",
        group: "ANEXOS",
        confidence: "ALTA",
        userCreated: true,
      });

      const mockPostgres = createMockPostgresService({
        manualEntityCount: 2,
        createdRecord,
      });

      const service = new ReviewService(mockPostgres, mockOpenRouter);

      const result = await service.createEntity("doc-1", {
        label: "CAMPO_CUSTOM",
        value: "Valor Custom",
        group: "ANEXOS",
      });

      expect(result.userCreated).toBe(true);
      expect(result.label).toBe("CAMPO_CUSTOM");
    });

    it("should throw ForbiddenException when limit is reached", async () => {
      const mockPostgres = createMockPostgresService({
        manualEntityCount: 5,
      });

      const service = new ReviewService(mockPostgres, mockOpenRouter);

      await expect(
        service.createEntity("doc-1", {
          label: "FIELD",
          value: "value",
          group: "PARTES",
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("countManualEntities", () => {
    it("should return count, limit, and canAddMore", async () => {
      const mockPostgres = createMockPostgresService({
        manualEntityCount: 3,
      });

      const service = new ReviewService(mockPostgres, mockOpenRouter);

      const result = await service.countManualEntities("doc-1");

      expect(result.count).toBe(3);
      expect(result.limit).toBe(5);
      expect(result.canAddMore).toBe(true);
    });

    it("should return canAddMore: false when at limit", async () => {
      const mockPostgres = createMockPostgresService({
        manualEntityCount: 5,
      });

      const service = new ReviewService(mockPostgres, mockOpenRouter);

      const result = await service.countManualEntities("doc-1");

      expect(result.count).toBe(5);
      expect(result.canAddMore).toBe(false);
    });
  });
});