import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { ReviewService } from "./review.service";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
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
    ...overrides,
  };
}

function createMockPostgresService(setup: {
  entityRecord: EntityRecord | null;
  updatedRecord?: EntityRecord | null;
}): PostgresService {
  const { entityRecord, updatedRecord } = setup;

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
      const service = new ReviewService(mockPostgres);

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
      const service = new ReviewService(mockPostgres);

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
      const service = new ReviewService(mockPostgres);

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
      const service = new ReviewService(mockPostgres);

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
      const service = new ReviewService(mockPostgres);

      const result = await service.updateEntity("doc-4", "entity-4", {
        reviewed: true,
      });

      expect(result.sourceSpan).toEqual({ start: 100, end: 200 });
    });
  });
});