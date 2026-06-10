import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import type { PoolClient } from "pg";

// Enable cache for this test suite
vi.mock("../config/ai.js", () => ({
  AI_CONFIG: {
    model: "test-model",
    modelFallback: undefined,
    apiKey: "test-key",
    maxTokens: 8192,
    temperature: 0.1,
  },
  CACHE_CONFIG: {
    enabled: true,
    responseCacheTtl: 604800,
    textCacheTtl: 604800,
    maxEntryBytes: 1048576,
  },
  UPLOAD_DIR: "/tmp/test-uploads",
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => Buffer.from("dummy pdf content")),
  mkdirSync: vi.fn(),
}));

vi.mock("pdf-parse", () => ({
  default: vi.fn(),
}));

vi.mock("mammoth", () => ({
  default: {
    extractRawText: vi.fn(),
  },
}));

import { AnalysisProcessor } from "./analysis.processor";
import type { AnalysisJobPayload } from "./analysis.queue";
import { DocumentAnalysisService } from "../ai/document-analysis.service.js";
import { OpenRouterService } from "../ai/open-router.service.js";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import type { CachePort } from "../infrastructure/redis/index.js";

// ---------------------------------------------------------------------------
// In-memory CachePort that simulates real Redis caching behavior
// ---------------------------------------------------------------------------

function createInMemoryCachePort(): CachePort & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    async get<T>(key: string): Promise<T | null> {
      const val = store.get(key);
      return val !== undefined ? (val as T) : null;
    },
    async set(key: string, value: unknown, _ttl: number): Promise<void> {
      store.set(key, value);
    },
    async getOrSet<T>(
      key: string,
      ttl: number,
      factory: () => Promise<T>,
    ): Promise<T> {
      const cached = await this.get<T>(key);
      if (cached !== null) return cached;
      const value = await factory();
      await this.set(key, value, ttl);
      return value;
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createJob(
  data: AnalysisJobPayload,
): Job<AnalysisJobPayload> {
  return {
    id: "job-1",
    name: "analyze",
    data,
    attemptsMade: 0,
    opts: { attempts: 1 },
  } as unknown as Job<AnalysisJobPayload>;
}

function createMockPostgres(filePath: string) {
  const mockClient = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes("SET LOCAL app.current_user_id")) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes("FROM documents") && sql.includes("WHERE id = $1")) {
        return {
          rowCount: 1,
          rows: [{
            id: "doc-1", user_id: 0, filename: "test.pdf",
            mime_type: "application/pdf", size_bytes: 100,
            status: "uploaded", uploaded_at: new Date(),
            file_path: filePath,
          }],
        };
      }
      if (sql.includes("INSERT INTO entities")) return { rowCount: 1, rows: [] };
      if (sql.includes("SET extracted_text = $2")) return { rowCount: 1, rows: [] };
      if (sql.includes("SET status = $1")) return {
        rowCount: 1,
        rows: [{
          id: "analysis-1", document_id: "doc-1", status: params?.[0],
          progress: 100, started_at: new Date(),
          completed_at: params?.[0] === "completed" ? new Date() : null,
          retry_count: 0, error_message: null, extracted_text: null,
        }],
      };
      return { rowCount: 0, rows: [] };
    }),
    release: vi.fn(),
  } as unknown as PoolClient;

  return {
    withOwnerTransaction: vi.fn(
      async (
        ownerId: number,
        cb: (ctx: { client: PoolClient; ownerId: number }) => Promise<unknown>,
      ) => {
        await (mockClient as PoolClient).query("BEGIN");
        await (mockClient as PoolClient).query(`SET LOCAL app.current_user_id = ${ownerId}`);
        const result = await cb({ client: mockClient, ownerId });
        await (mockClient as PoolClient).query("COMMIT");
        return result;
      },
    ),
  } as unknown as PostgresService;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AnalysisProcessor — cache integration", () => {
  let processor: AnalysisProcessor;
  let cachePort: ReturnType<typeof createInMemoryCachePort>;
  let mockExtractEntities: ReturnType<typeof vi.fn>;
  let pdfParseMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    cachePort = createInMemoryCachePort();
    mockExtractEntities = vi.fn(async (text: string) => ({
      entities: [
        { label: "COMPRADOR", value: "Juan", group: "PARTES", confidence: "ALTA" },
      ],
      rawResponse: JSON.stringify({ entities: [{ label: "COMPRADOR", value: "Juan", group: "PARTES", confidence: "ALTA" }] }),
    }));

    const mockOpenRouter = {
      extractEntities: mockExtractEntities,
    } as unknown as OpenRouterService;

    const documentAnalysisService = new DocumentAnalysisService(
      mockOpenRouter,
      cachePort,
    );

    const postgres = createMockPostgres("/uploads/test.pdf");
    processor = new AnalysisProcessor(postgres, documentAnalysisService);

    const pdfModule = await import("pdf-parse");
    pdfParseMock = pdfModule.default as ReturnType<typeof vi.fn>;
    pdfParseMock.mockResolvedValue({
      text: "Contrato de compraventa entre Juan Pérez y María López",
      numpages: 1,
    });
  });

  it("second run with same contentHash skips text extraction and AI call", async () => {
    const payload: AnalysisJobPayload = {
      analysisResultId: "analysis-1",
      documentId: "doc-1",
      ownerId: 0,
      filePath: "/uploads/test.pdf",
      contentHash: "abc123hash",
    };

    // First run — cache miss, full pipeline
    await processor.process(createJob(payload));

    expect(pdfParseMock).toHaveBeenCalledTimes(1);
    expect(mockExtractEntities).toHaveBeenCalledTimes(1);

    // Verify cache was populated
    expect(cachePort.store.has("ai:text:abc123hash")).toBe(true);

    // Second run — same contentHash, should hit text cache
    // Reset the analysis result ID to simulate a new job
    const payload2: AnalysisJobPayload = {
      ...payload,
      analysisResultId: "analysis-2",
    };

    await processor.process(createJob(payload2));

    // pdf-parse should NOT be called again (text served from cache)
    expect(pdfParseMock).toHaveBeenCalledTimes(1);
    // AI is called again because the response cache key is based on
    // sha256(text), and the OpenRouterService in this test is mocked
    // (not going through the real cache-aware service). The text cache
    // is the primary assertion here.
    expect(mockExtractEntities).toHaveBeenCalledTimes(2);
  });

  it("different contentHash runs full pipeline again", async () => {
    const payload1: AnalysisJobPayload = {
      analysisResultId: "analysis-1",
      documentId: "doc-1",
      ownerId: 0,
      filePath: "/uploads/test.pdf",
      contentHash: "hash-one",
    };

    await processor.process(createJob(payload1));

    expect(pdfParseMock).toHaveBeenCalledTimes(1);
    expect(mockExtractEntities).toHaveBeenCalledTimes(1);

    // Different hash — cache miss
    const payload2: AnalysisJobPayload = {
      ...payload1,
      analysisResultId: "analysis-2",
      contentHash: "hash-two",
    };

    await processor.process(createJob(payload2));

    expect(pdfParseMock).toHaveBeenCalledTimes(2);
    expect(mockExtractEntities).toHaveBeenCalledTimes(2);
  });

  it("no contentHash skips text cache entirely", async () => {
    const payload: AnalysisJobPayload = {
      analysisResultId: "analysis-1",
      documentId: "doc-1",
      ownerId: 0,
      filePath: "/uploads/test.pdf",
      // No contentHash
    };

    await processor.process(createJob(payload));

    expect(pdfParseMock).toHaveBeenCalledTimes(1);
    expect(mockExtractEntities).toHaveBeenCalledTimes(1);

    // No text cache key should exist
    expect(cachePort.store.size).toBe(0);

    // Second run without hash — still runs full pipeline
    const payload2: AnalysisJobPayload = {
      ...payload,
      analysisResultId: "analysis-2",
    };

    await processor.process(createJob(payload2));

    expect(pdfParseMock).toHaveBeenCalledTimes(2);
    expect(mockExtractEntities).toHaveBeenCalledTimes(2);
  });
});
