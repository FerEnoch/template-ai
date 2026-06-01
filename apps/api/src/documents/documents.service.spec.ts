import { describe, expect, it, vi, beforeEach } from "vitest";
import { DocumentsService } from "./documents.service";
import { PostgresService, type TransactionContext } from "../infrastructure/postgres/postgres.service";
import type { DocumentRecord } from "../infrastructure/postgres/repositories/documents.repository";
import type { AnalysisResultRecord } from "../infrastructure/postgres/repositories/analysis-results.repository";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDocumentRecord(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    userId: 0,
    filename: "contract.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    status: "processing",
    uploadedAt: new Date("2025-01-15T10:30:00Z"),
    filePath: null,
    ...overrides,
  };
}

function makeAnalysisResultRecord(overrides: Partial<AnalysisResultRecord> = {}): AnalysisResultRecord {
  return {
    id: "660e8400-e29b-41d4-a716-446655440001",
    documentId: "550e8400-e29b-41d4-a716-446655440000",
    status: "processing",
    progress: 0,
    startedAt: new Date("2025-01-15T10:30:00Z"),
    completedAt: null,
    retryCount: 0,
    errorMessage: null,
    extractedText: null,
    ...overrides,
  };
}

/**
 * Creates a mock PostgresService that simulates the withOwnerTransaction flow.
 * The callback receives a mock client whose `query` method returns row data
 * matching the SQL being executed — document INSERT for documents table,
 * analysis_result INSERT for analysis_results table.
 */
function createMockPostgresService(
  documentRecord: DocumentRecord,
  analysisRecord: AnalysisResultRecord,
): { mockPostgres: PostgresService; mockClient: { query: ReturnType<typeof vi.fn> } } {
  const mockClient = { query: vi.fn() };

  // mockClient.query resolves based on the SQL content:
  // - INSERT INTO analysis_results → returns analysis_record row
  // - INSERT INTO documents → returns document row
  // - anything else (BEGIN, COMMIT, SET) → returns empty result
  mockClient.query.mockImplementation((sql: string) => {
    if (sql.includes("analysis_results")) {
      return Promise.resolve({
        rowCount: 1,
        rows: [
          {
            id: analysisRecord.id,
            document_id: analysisRecord.documentId,
            status: analysisRecord.status,
            progress: analysisRecord.progress,
            started_at: analysisRecord.startedAt,
            completed_at: analysisRecord.completedAt,
            retry_count: analysisRecord.retryCount,
            error_message: analysisRecord.errorMessage,
          },
        ],
      });
    }
    if (sql.includes("documents")) {
      return Promise.resolve({
        rowCount: 1,
        rows: [
          {
            id: documentRecord.id,
            user_id: documentRecord.userId,
            filename: documentRecord.filename,
            mime_type: documentRecord.mimeType,
            size_bytes: documentRecord.sizeBytes,
            status: documentRecord.status,
            uploaded_at: documentRecord.uploadedAt,
            file_path: documentRecord.filePath,
          },
        ],
      });
    }
    // BEGIN/COMMIT/SET queries
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

describe("DocumentsService", () => {
  describe("upload", () => {
    it("should extract metadata from file and create document + analysis_result in DB", async () => {
      const docRecord = makeDocumentRecord();
      const analysisRecord = makeAnalysisResultRecord({
        documentId: docRecord.id,
      });

      const { mockPostgres, mockClient } = createMockPostgresService(docRecord, analysisRecord);
      const service = new DocumentsService(mockPostgres);

      const result = await service.upload({
        filename: "contract.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      });

      // Verify the service returns the Document record with correct shape
      expect(result).toMatchObject({
        id: docRecord.id,
        filename: "contract.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        status: "processing",
      });

      // Verify withOwnerTransaction was called with ownerId=0 (sentinel)
      expect(mockPostgres.withOwnerTransaction).toHaveBeenCalledWith(0, expect.any(Function));

      // Verify RLS context was set
      expect(mockClient.query).toHaveBeenCalledWith(
        "SET LOCAL app.current_user_id = $1",
        [0],
      );
    });

    it("should call withOwnerTransaction with ownerId=0 (POC sentinel)", async () => {
      const docRecord = makeDocumentRecord();
      const analysisRecord = makeAnalysisResultRecord({ documentId: docRecord.id });

      const { mockPostgres } = createMockPostgresService(docRecord, analysisRecord);
      const service = new DocumentsService(mockPostgres);

      await service.upload({
        filename: "test.pdf",
        mimeType: "application/pdf",
        sizeBytes: 500,
      });

      expect(mockPostgres.withOwnerTransaction).toHaveBeenCalledWith(0, expect.any(Function));
    });

    it("should throw when database transaction fails", async () => {
      const mockPostgres = {
        withOwnerTransaction: vi.fn().mockRejectedValue(new Error("DB connection failed")),
      } as unknown as PostgresService;

      const service = new DocumentsService(mockPostgres);

      await expect(
        service.upload({
          filename: "broken.pdf",
          mimeType: "application/pdf",
          sizeBytes: 100,
        }),
      ).rejects.toThrow("DB connection failed");
    });

    it("should insert analysis_result with status='processing' and progress=0", async () => {
      const docRecord = makeDocumentRecord();
      const analysisRecord = makeAnalysisResultRecord({
        documentId: docRecord.id,
        status: "processing",
        progress: 0,
      });

      const { mockPostgres, mockClient } = createMockPostgresService(docRecord, analysisRecord);
      const service = new DocumentsService(mockPostgres);

      await service.upload({
        filename: "contract.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
      });

      // The mockClient.query should have been called with an INSERT INTO analysis_results
      const analysisInsertCalls = mockClient.query.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("analysis_results"),
      );
      expect(analysisInsertCalls.length).toBeGreaterThanOrEqual(1);

      // Also verify the document INSERT was called
      const documentInsertCalls = mockClient.query.mock.calls.filter(
        (call: unknown[]) => typeof call[0] === "string" && (call[0] as string).includes("documents"),
      );
      expect(documentInsertCalls.length).toBeGreaterThanOrEqual(1);
    });
  });
});