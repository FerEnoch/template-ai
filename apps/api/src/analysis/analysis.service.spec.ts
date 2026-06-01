import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { AnalysisService } from "./analysis.service";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { DocumentAnalysisService } from "../ai/document-analysis.service.js";
import type { AnalysisResultRecord } from "../infrastructure/postgres/repositories/analysis-results.repository";
import type { EntityRecord } from "../infrastructure/postgres/repositories/entities.repository";
import type { DocumentRecord } from "../infrastructure/postgres/repositories/documents.repository";

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
    extractedText: null,
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

function makeDocumentRecord(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    userId: 0,
    filename: "test.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    status: "uploaded",
    uploadedAt: new Date("2026-05-27T10:30:00.000Z"),
    filePath: "/uploads/test.pdf",
    ...overrides,
  };
}

const mockAnalyze = vi.fn();

function createMockDocumentAnalysisService(): DocumentAnalysisService {
  return { analyze: mockAnalyze } as unknown as DocumentAnalysisService;
}

/**
 * Creates a mock PostgresService that simulates withOwnerTransaction.
 * The mock client's query method resolves based on SQL content:
 * - SELECT analysis_results → returns the analysis record row
 * - UPDATE analysis_results (incrementProgress) → returns updated row
 * - UPDATE analysis_results (updateStatus) → returns updated row
 * - UPDATE analysis_results (incrementRetry) → returns updated row
 * - SELECT documents → returns document row
 * - SELECT entities → returns entity rows
 * - INSERT INTO entities → returns entity rows
 * - anything else (BEGIN, COMMIT, SET) → returns empty result
 */
function createMockPostgresService(setup: {
  analysisRecords: AnalysisResultRecord[];
  entityRecords?: EntityRecord[];
  documentRecords?: DocumentRecord[];
  incrementedRecord?: AnalysisResultRecord;
  statusUpdatedRecord?: AnalysisResultRecord;
  /**
   * When true, atomicTransitionToAnalyzing returns 0 rows
   * (simulating a lost race where another request already transitioned).
   */
  atomicTransitionNoop?: boolean;
}): PostgresService {
  const { analysisRecords, entityRecords = [], documentRecords = [] } = setup;

  const mockClient = {
    query: vi.fn((sql: string, params?: unknown[]) => {
      // RLS session variable
      if (sql.includes("SET LOCAL")) {
        return Promise.resolve({ rowCount: 0, rows: [] });
      }
      // BEGIN/COMMIT/ROLLBACK
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return Promise.resolve({ rowCount: 0, rows: [] });
      }

      // UPDATE analysis_results — incrementProgress (has LEAST)
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
              retry_count: record.retryCount ?? 0,
              error_message: record.errorMessage ?? null,
            },
          ],
        });
      }

      // UPDATE analysis_results — incrementRetryCount (has retry_count + 1)
      if (sql.includes("UPDATE analysis_results") && sql.includes("retry_count + 1")) {
        const record = analysisRecords[0];
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              id: record.id,
              document_id: record.documentId,
              status: "failed",
              progress: record.progress,
              started_at: record.startedAt,
              completed_at: null,
              retry_count: (record.retryCount ?? 0) + 1,
              error_message: typeof params?.[1] === "string" ? params[1] : "AI extraction failed",
            },
          ],
        });
      }

      // UPDATE analysis_results — atomicTransitionToAnalyzing (has AND status = 'processing')
      if (sql.includes("UPDATE analysis_results") && sql.includes("AND status = 'processing'")) {
        if (setup.atomicTransitionNoop) {
          return Promise.resolve({ rowCount: 0, rows: [] });
        }
        const record = analysisRecords[0];
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              id: record.id,
              document_id: record.documentId,
              status: "analyzing",
              progress: Math.min(record.progress + 25, 100),
              started_at: record.startedAt,
              completed_at: null,
              retry_count: record.retryCount ?? 0,
              error_message: record.errorMessage ?? null,
            },
          ],
        });
      }

      // UPDATE analysis_results — updateStatus (has SET status = $1 or completed_at)
      if (sql.includes("UPDATE analysis_results") && (sql.includes("SET status") || sql.includes("SET completed_at"))) {
        const statusValue = (params?.[0] as string) ?? "completed";
        const record = setup.statusUpdatedRecord ?? {
          ...analysisRecords[0],
          status: statusValue,
          completedAt: statusValue === "completed" ? new Date() : null,
          progress: analysisRecords[0].progress,
        };
        return Promise.resolve({
          rowCount: 1,
          rows: [
            {
              id: record.id,
              document_id: record.documentId,
              status: record.status ?? statusValue,
              progress: record.progress,
              started_at: record.startedAt,
              completed_at: record.completedAt ?? (statusValue === "completed" ? new Date() : null),
              retry_count: record.retryCount ?? 0,
              error_message: record.errorMessage ?? null,
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
            retry_count: r.retryCount ?? 0,
            error_message: r.errorMessage ?? null,
          })),
        });
      }

      // SELECT documents
      if (sql.includes("SELECT") && sql.includes("documents") && sql.includes("WHERE id")) {
        return Promise.resolve({
          rowCount: documentRecords.length > 0 ? 1 : 0,
          rows: documentRecords.map((d) => ({
            id: d.id,
            user_id: d.userId,
            filename: d.filename,
            mime_type: d.mimeType,
            size_bytes: d.sizeBytes,
            status: d.status,
            uploaded_at: d.uploadedAt,
            file_path: d.filePath,
          })),
        });
      }

      // SELECT entities (findByAnalysisResultId)
      if (sql.includes("SELECT") && sql.includes("entities") && sql.includes("analysis_result_id")) {
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

      // SELECT entities (general)
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
          rowCount: entityRecords.length > 0 ? entityRecords.length : 1,
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
    withConnection: vi.fn(
      async (cb: (client: unknown) => Promise<unknown>) => {
        return await cb(mockClient as never);
      },
    ),
  } as unknown as PostgresService;

  return mockPostgres;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AnalysisService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFullResult", () => {
    it("should throw NotFoundException when document has no analysis result", async () => {
      const mockPostgres = createMockPostgresService({ analysisRecords: [] });
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

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
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

      const result = await service.getFullResult("doc-1");

      expect(result.progress).toBe(25);
      expect(result.status).toBe("processing");
      expect(result.documentId).toBe("doc-1");
    });

    it("should call AI extraction and insert entities when progress reaches 100", async () => {
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

      const entityRecords = [
        makeEntityRecord({ analysisResultId: "analysis-1", documentId: "doc-1" }),
      ];

      const documentRecords = [
        makeDocumentRecord({ id: "doc-1", filePath: "/uploads/test.pdf" }),
      ];

      mockAnalyze.mockResolvedValue({
        success: true,
        entities: [
          { label: "COMPRADOR", value: "Juan Pérez", group: "PARTES", confidence: "ALTA" },
        ],
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [initialRecord],
        incrementedRecord,
        statusUpdatedRecord: completedRecord,
        entityRecords,
        documentRecords,
      });
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

      const result = await service.getFullResult("doc-1");

      expect(result.progress).toBe(100);
      expect(result.status).toBe("completed");
      expect(result.documentId).toBe("doc-1");
      expect(result.extractedText).toBeNull(); // mock did not include extractedText
      expect(mockAnalyze).toHaveBeenCalledWith("/uploads/test.pdf");
    });

    it("should return terminal (no entities) when atomic guard is lost to a concurrent request", async () => {
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

      const mockPostgres = createMockPostgresService({
        analysisRecords: [initialRecord],
        incrementedRecord,
        atomicTransitionNoop: true, // <-- atomic guard returns null (race lost)
      });
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

      const result = await service.getFullResult("doc-1");

      // Lost the race — returns terminal with progress 100 but NO entities
      // Status remains "processing" because the atomic guard didn't transition it
      expect(result.status).toBe("processing");
      expect(result.progress).toBe(100);
      expect(result.entities).toEqual([]);
      // AI was NOT called (another request won the atomic guard)
      expect(mockAnalyze).not.toHaveBeenCalled();
      // Next poll will see "analyzing" (set by the winner) and eventually "completed"
    });

    it("should return completed result as-is (idempotent)", async () => {
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
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

      const result = await service.getFullResult("doc-1");

      expect(result.status).toBe("completed");
      expect(result.progress).toBe(100);
      // Should NOT call analyze for completed results
      expect(mockAnalyze).not.toHaveBeenCalled();
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
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

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
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

      const result = await service.getFullResult("doc-1");

      expect(result.progress).toBe(75);
      expect(result.status).toBe("processing");
      expect(result.completedAt).toBeNull();
      expect(mockAnalyze).not.toHaveBeenCalled();
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
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

      const result = await service.getFullResult("doc-1");

      expect(result.progress).toBe(75);
      expect(result.entities).toEqual([]);
    });

    it("should return permanent failure when retryCount >= 3", async () => {
      const failedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "failed",
        progress: 100,
        retryCount: 3,
        errorMessage: "Max retries exceeded",
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [failedRecord],
      });
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

      const result = await service.getFullResult("doc-1");

      expect(result.status).toBe("failed");
      expect(result.progress).toBe(100);
      expect(result.entities).toEqual([]);
      expect(mockAnalyze).not.toHaveBeenCalled();
    });

    it("should return pending result immediately without incrementing progress", async () => {
      const pendingRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "pending",
        progress: 0,
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [pendingRecord],
      });
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

      const result = await service.getFullResult("doc-1");

      expect(result.status).toBe("pending");
      expect(result.progress).toBe(0);
      expect(result.entities).toEqual([]);
    });

    it("should fail gracefully when AI extraction fails", async () => {
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

      mockAnalyze.mockResolvedValue({
        success: false,
        error: "AI extraction failed",
      });

      const documentRecords = [
        makeDocumentRecord({ id: "doc-1", filePath: "/uploads/test.pdf" }),
      ];

      const mockPostgres = createMockPostgresService({
        analysisRecords: [initialRecord],
        incrementedRecord,
        documentRecords,
      });
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

      const result = await service.getFullResult("doc-1");

      expect(result.status).toBe("failed");
      expect(mockAnalyze).toHaveBeenCalledWith("/uploads/test.pdf");
    });
  });

  describe("getStatus (read-only)", () => {
    it("should throw NotFoundException when document has no analysis result", async () => {
      const mockPostgres = createMockPostgresService({ analysisRecords: [] });
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

      await expect(service.getStatus("nonexistent-id")).rejects.toThrow(NotFoundException);
    });

    it("should return completed status without modifying anything", async () => {
      const completedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "completed",
        progress: 100,
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [completedRecord],
      });
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

      const result = await service.getStatus("doc-1");

      expect(result.status).toBe("completed");
      expect(result.progress).toBe(100);
      expect(result.documentId).toBe("doc-1");
    });

    it("should return failed status without side effects", async () => {
      const failedRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "failed",
        progress: 30,
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [failedRecord],
      });
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

      const result = await service.getStatus("doc-1");

      expect(result.status).toBe("failed");
      expect(result.progress).toBe(30);
    });

    it("should return pending status without side effects", async () => {
      const pendingRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "pending",
        progress: 0,
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [pendingRecord],
      });
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

      const result = await service.getStatus("doc-1");

      expect(result.status).toBe("pending");
      expect(result.progress).toBe(0);
    });

    it("should return analyzing status without side effects", async () => {
      const analyzingRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "analyzing",
        progress: 100,
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [analyzingRecord],
      });
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

      const result = await service.getStatus("doc-1");

      expect(result.status).toBe("analyzing");
      expect(result.progress).toBe(100);
    });

    it("should return processing status without incrementing progress", async () => {
      const processingRecord = makeAnalysisResultRecord({
        id: "analysis-1",
        documentId: "doc-1",
        status: "processing",
        progress: 50,
      });

      const mockPostgres = createMockPostgresService({
        analysisRecords: [processingRecord],
      });
      // The mock's withConnection will use the same mockClient;
      // no incrementedRecord is needed because getStatus no longer mutates.
      const mockDocAnalysis = createMockDocumentAnalysisService();
      const service = new AnalysisService(mockPostgres, mockDocAnalysis);

      const result = await service.getStatus("doc-1");

      // Read-only: returns the exact stored progress without incrementing
      expect(result.status).toBe("processing");
      expect(result.progress).toBe(50);
      expect(result.documentId).toBe("doc-1");
    });
  });
});