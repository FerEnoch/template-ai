import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { AnalysisService } from "./analysis.service";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import type { AnalysisResultRecord } from "../infrastructure/postgres/repositories/analysis-results.repository";
import type { EntityRecord } from "../infrastructure/postgres/repositories/entities.repository";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAnalysisResultRecord(
  overrides: Partial<AnalysisResultRecord> = {},
): AnalysisResultRecord {
  return {
    id: "analysis-id-1",
    documentId: "550e8400-e29b-41d4-a716-446655440000",
    status: "processing",
    progress: 0,
    startedAt: new Date("2026-05-27T10:30:05.000Z"),
    completedAt: null,
    retryCount: 0,
    errorMessage: null,
    ...overrides,
  };
}

function makeEntityRecord(overrides: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id: "entity-id-1",
    analysisResultId: "analysis-id-1",
    documentId: "550e8400-e29b-41d4-a716-446655440000",
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

/**
 * Creates a mock PostgresService that simulates withOwnerTransaction.
 * The mock client's query method resolves based on SQL content:
 * - SELECT analysis_results → returns the analysis record row
 * - UPDATE analysis_results (incrementProgress) → returns updated row
 * - UPDATE analysis_results (updateStatus) → returns updated row
 * - SELECT entities → returns entity rows
 * - INSERT INTO entities → returns entity rows
 * - anything else (BEGIN, COMMIT, SET) → returns empty result
 */
function createMockPostgresService(setup: {
  analysisRecords: AnalysisResultRecord[];
  entityRecords?: EntityRecord[];
  incrementedRecord?: AnalysisResultRecord;
  statusUpdatedRecord?: AnalysisResultRecord;
  /** Simulates entities already existing for race-condition guard (FIX 4) */
  existingEntitiesOnFirstLookup?: EntityRecord[];
}): PostgresService {
  const { analysisRecords, entityRecords = [], existingEntitiesOnFirstLookup } = setup;

  // Track how many times findByAnalysisResultId has been called to simulate
  // the race condition guard: first call returns existing, second returns inserted
  let findByAnalysisResultIdCallCount = 0;

  const mockClient = {
    query: vi.fn((sql: string, _params?: unknown[]) => {
      // RLS session variable
      if (sql.includes("SET LOCAL")) {
        return Promise.resolve({ rowCount: 0, rows: [] });
      }
      // BEGIN/COMMIT
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return Promise.resolve({ rowCount: 0, rows: [] });
      }

      // UPDATE analysis_results — incrementProgress
      if (sql.includes("UPDATE analysis_results") && sql.includes("LEAST")) {
        const record = setup.incrementedRecord ?? analysisRecords[0];
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              id: record.id,
              document_id: record.documentId,
              status: record.status,
              progress: record.progress,
              started_at: record.startedAt,
              completed_at: record.completedAt,
            },
          ],
        });
      }

      // UPDATE analysis_results — updateStatus
      if (sql.includes("UPDATE analysis_results") && sql.includes("completed")) {
        const record = setup.statusUpdatedRecord ?? {
          ...analysisRecords[0],
          status: "completed",
          completedAt: new Date(),
        };
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              id: record.id,
              document_id: record.documentId,
              status: record.status,
              progress: record.progress,
              started_at: record.startedAt,
              completed_at: record.completedAt,
            },
          ],
        });
      }

      // SELECT analysis_results
      if (sql.includes("SELECT") && sql.includes("analysis_results")) {
        return Promise.resolve({
          rowCount: analysisRecords.length,
          rows: analysisRecords.map((r) => ({
            id: r.id,
            document_id: r.documentId,
            status: r.status,
            progress: r.progress,
            started_at: r.startedAt,
            completed_at: r.completedAt,
          })),
        });
      }

      // SELECT entities (findByAnalysisResultId)
      if (sql.includes("SELECT") && sql.includes("entities") && sql.includes("analysis_result_id")) {
        findByAnalysisResultIdCallCount++;

        // First call: return existing entities (for the race guard check)
        // or empty array if no pre-existing entities
        if (findByAnalysisResultIdCallCount === 1) {
          const entities = existingEntitiesOnFirstLookup !== undefined
            ? existingEntitiesOnFirstLookup
            : entityRecords;
          return Promise.resolve({
            rowCount: entities.length,
            rows: entities.map((e) => ({
              id: e.id,
              analysis_result_id: e.analysisResultId,
              document_id: e.documentId,
              label: e.label,
              value: e.value,
              group: e.group,
              confidence: e.confidence,
              source_span: e.sourceSpan ? JSON.stringify(e.sourceSpan) : null,
              reviewed: e.reviewed,
              excluded: e.excluded,
            })),
          });
        }

        // Second+ call: return entity records (the inserted ones or the same)
        return Promise.resolve({
          rowCount: entityRecords.length,
          rows: entityRecords.map((e) => ({
            id: e.id,
            analysis_result_id: e.analysisResultId,
            document_id: e.documentId,
            label: e.label,
            value: e.value,
            group: e.group,
            confidence: e.confidence,
            source_span: e.sourceSpan ? JSON.stringify(e.sourceSpan) : null,
            reviewed: e.reviewed,
            excluded: e.excluded,
          })),
        });
      }

      // SELECT entities (findById or general) — for findById in review
      if (sql.includes("SELECT") && sql.includes("entities")) {
        return Promise.resolve({
          rowCount: entityRecords.length,
          rows: entityRecords.map((e) => ({
            id: e.id,
            analysis_result_id: e.analysisResultId,
            document_id: e.documentId,
            label: e.label,
            value: e.value,
            group: e.group,
            confidence: e.confidence,
            source_span: e.sourceSpan ? JSON.stringify(e.sourceSpan) : null,
            reviewed: e.reviewed,
            excluded: e.excluded,
          })),
        });
      }

      // INSERT INTO entities (bulk)
      if (sql.includes("INSERT INTO entities")) {
        return Promise.resolve({
          rowCount: 11,
          rows: entityRecords.map((e) => ({
            id: e.id,
            analysis_result_id: e.analysisResultId,
            document_id: e.documentId,
            label: e.label,
            value: e.value,
            group: e.group,
            confidence: e.confidence,
            source_span: e.sourceSpan ? JSON.stringify(e.sourceSpan) : null,
            reviewed: e.reviewed,
            excluded: e.excluded,
          })),
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

describe("AnalysisService", () => {
  describe("getFullResult", () => {
    it("should throw NotFoundException when document has no analysis result", async () => {
      // The mock returns empty rows for SELECT analysis_results
      const mockPostgres = createMockPostgresService({ analysisRecords: [] });
      const service = new AnalysisService(mockPostgres);

      await expect(service.getFullResult("nonexistent-id")).rejects.toThrow(NotFoundException);
      await expect(service.getFullResult("nonexistent-id")).rejects.toThrow(
        "Analysis result not found",
      );
    });

    it("should increment progress by 25 when status is processing and progress < 100", async () => {
      const initialRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "processing",
        progress: 0,
      });
      const incrementedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "processing",
        progress: 25,
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [initialRecord],
        incrementedRecord,
      });
      const service = new AnalysisService(mockPostgres);

      const result = await service.getFullResult("doc-1");

      expect(result.progress).toBe(25);
      expect(result.status).toBe("processing");
      expect(result.documentId).toBe("doc-1");
    });

    it("should set status to completed and insert sample entities when progress reaches 100", async () => {
      const initialRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "processing",
        progress: 75,
      });
      // After incrementing, progress becomes 100
      const incrementedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "processing",
        progress: 100,
      });
      // Status update to completed
      const completedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "completed",
        progress: 100,
        completedAt: new Date("2026-05-27T10:35:22.000Z"),
      });

      const entityRecords = [
        makeEntityRecord({ analysisResultId: "analysis-1", documentId: "doc-1" }),
      ];

      const mockPostgres = createMockPostgresService({
        analysisRecords: [initialRecord],
        incrementedRecord,
        statusUpdatedRecord: completedRecord,
        entityRecords,
        // No existing entities on first lookup (new insertion)
        existingEntitiesOnFirstLookup: [],
      });
      const service = new AnalysisService(mockPostgres);

      const result = await service.getFullResult("doc-1");

      expect(result.progress).toBe(100);
      expect(result.status).toBe("completed");
      expect(result.documentId).toBe("doc-1");
    });

    it("should return completed result as-is without re-inserting entities (idempotent)", async () => {
      const completedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "completed",
        progress: 100,
        completedAt: new Date("2026-05-27T10:35:22.000Z"),
      });

      const entityRecords = [
        makeEntityRecord({ analysisResultId: "analysis-1", documentId: "doc-1" }),
      ];

      const mockPostgres = createMockPostgresService({
        analysisRecords: [completedRecord],
        entityRecords,
      });
      const service = new AnalysisService(mockPostgres);

      const result = await service.getFullResult("doc-1");

      expect(result.status).toBe("completed");
      expect(result.progress).toBe(100);
    });

    it("should return entities when status is completed", async () => {
      const completedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "completed",
        progress: 100,
        completedAt: new Date("2026-05-27T10:35:22.000Z"),
      });

      const entityRecords = [
        makeEntityRecord({
          id: "e1",
          analysisResultId: "analysis-1",
          documentId: "doc-1",
          label: "COMPRADOR",
          value: "María González",
          group: "PARTES",
          confidence: "ALTA",
        }),
        makeEntityRecord({
          id: "e2",
          analysisResultId: "analysis-1",
          documentId: "doc-1",
          label: "INMUEBLE",
          value: "Av. Reforma 1234",
          group: "INMUEBLE",
          confidence: "MEDIA",
        }),
      ];

      const mockPostgres = createMockPostgresService({
        analysisRecords: [completedRecord],
        entityRecords,
      });
      const service = new AnalysisService(mockPostgres);

      const result = await service.getFullResult("doc-1");

      expect(result.entities).toHaveLength(2);
      expect(result.entities![0].label).toBe("COMPRADOR");
      expect(result.entities![1].label).toBe("INMUEBLE");
    });

    it("should increment from 50 to 75 and keep status processing (triangulation)", async () => {
      const initialRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "processing",
        progress: 50,
      });
      const incrementedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "processing",
        progress: 75,
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [initialRecord],
        incrementedRecord,
      });
      const service = new AnalysisService(mockPostgres);

      const result = await service.getFullResult("doc-1");

      expect(result.progress).toBe(75);
      expect(result.status).toBe("processing");
      expect(result.completedAt).toBeNull();
    });

    it("should return empty entities when status is processing", async () => {
      const processingRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "processing",
        progress: 50,
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [processingRecord],
        incrementedRecord: makeAnalysisResultRecord({
          id: "analysis-1",
          documentId: "doc-1",
          status: "processing",
          progress: 75,
        }),
        entityRecords: [],
      });
      const service = new AnalysisService(mockPostgres);

      const result = await service.getFullResult("doc-1");

      // After increment, progress should be 75
      expect(result.progress).toBe(75);
      // No entities yet since still processing
      expect(result.entities).toEqual([]);
    });

    // --- FIX 1: "failed" status should NOT increment progress ---
    it("should return failed result immediately without incrementing progress (FIX 1)", async () => {
      const failedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "failed",
        progress: 30,
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [failedRecord],
      });
      const service = new AnalysisService(mockPostgres);

      const result = await service.getFullResult("doc-1");

      expect(result.status).toBe("failed");
      expect(result.progress).toBe(30);
      expect(result.entities).toEqual([]);

      // Verify progress was NOT incremented (stayed at 30, the original value)
      expect(result.progress).toBe(30);
    });

    it("should return pending result immediately without incrementing progress (FIX 1 triangulation)", async () => {
      const pendingRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "pending",
        progress: 0,
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [pendingRecord],
      });
      const service = new AnalysisService(mockPostgres);

      const result = await service.getFullResult("doc-1");

      expect(result.status).toBe("pending");
      expect(result.progress).toBe(0);
      expect(result.entities).toEqual([]);
    });

    // --- FIX 4: Race condition guard — skip bulkInsert if entities already exist ---
    it("should skip entity insertion if entities already exist when completing (FIX 4 race guard)", async () => {
      const initialRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "processing",
        progress: 75,
      });
      const incrementedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "processing",
        progress: 100,
      });
      const completedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "completed",
        progress: 100,
        completedAt: new Date("2026-05-27T10:35:22.000Z"),
      });

      // Entities already exist (simulating concurrent request that already inserted them)
      const existingEntities = [
        makeEntityRecord({ id: "e1", analysisResultId: "analysis-1", documentId: "doc-1" }),
        makeEntityRecord({ id: "e2", analysisResultId: "analysis-1", documentId: "doc-1" }),
      ];

      const mockPostgres = createMockPostgresService({
        analysisRecords: [initialRecord],
        incrementedRecord,
        statusUpdatedRecord: completedRecord,
        entityRecords: existingEntities,
        // First lookup returns existing entities (race condition scenario)
        existingEntitiesOnFirstLookup: existingEntities,
      });

      const service = new AnalysisService(mockPostgres);

      const result = await service.getFullResult("doc-1");

      expect(result.status).toBe("completed");
      expect(result.entities).toHaveLength(2);
    });
  });

  describe("getStatus", () => {
    it("should throw NotFoundException when document has no analysis result", async () => {
      const mockPostgres = createMockPostgresService({ analysisRecords: [] });
      const service = new AnalysisService(mockPostgres);

      await expect(service.getStatus("nonexistent-id")).rejects.toThrow(NotFoundException);
    });

    it("should return completed status with progress 100 without incrementing", async () => {
      const completedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "completed",
        progress: 100,
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [completedRecord],
      });
      const service = new AnalysisService(mockPostgres);

      const result = await service.getStatus("doc-1");

      expect(result.status).toBe("completed");
      expect(result.progress).toBe(100);
      expect(result.documentId).toBe("doc-1");
    });

    it("should return failed status without incrementing progress (FIX 2 — terminal state)", async () => {
      const failedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "failed",
        progress: 30,
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [failedRecord],
      });
      const service = new AnalysisService(mockPostgres);

      const result = await service.getStatus("doc-1");

      expect(result.status).toBe("failed");
      expect(result.progress).toBe(30);
    });

    it("should return pending status without incrementing progress (FIX 2 — terminal state triangulation)", async () => {
      const pendingRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "pending",
        progress: 0,
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [pendingRecord],
      });
      const service = new AnalysisService(mockPostgres);

      const result = await service.getStatus("doc-1");

      expect(result.status).toBe("pending");
      expect(result.progress).toBe(0);
    });

    // FIX 2: getStatus drives progress for "processing" status
    it("should increment progress when status is processing (FIX 2)", async () => {
      const processingRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "processing",
        progress: 50,
      });
      const incrementedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "processing",
        progress: 75,
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [processingRecord],
        incrementedRecord,
      });
      const service = new AnalysisService(mockPostgres);

      const result = await service.getStatus("doc-1");

      expect(result.status).toBe("processing");
      expect(result.progress).toBe(75);
    });

    it("should transition to completed when getStatus increments progress to 100 (FIX 2)", async () => {
      const processingRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "processing",
        progress: 75,
      });
      const incrementedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "processing",
        progress: 100,
      });
      const completedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "completed",
        progress: 100,
        completedAt: new Date("2026-05-27T10:35:22.000Z"),
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [processingRecord],
        incrementedRecord,
        statusUpdatedRecord: completedRecord,
      });
      const service = new AnalysisService(mockPostgres);

      const result = await service.getStatus("doc-1");

      expect(result.status).toBe("completed");
      expect(result.progress).toBe(100);
      // Lightweight response — no entities field
      expect(result).not.toHaveProperty("entities");
      expect(result).toEqual({
        documentId: "doc-1",
        status: "completed",
        progress: 100,
      });
    });
  });
});