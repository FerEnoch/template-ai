import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Job } from "bullmq";
import type { PoolClient } from "pg";
import { AnalysisProcessor } from "./analysis.processor";
import type { AnalysisJobPayload } from "./analysis.queue";
import { DocumentAnalysisService } from "../ai/document-analysis.service.js";
import { PostgresService } from "../infrastructure/postgres/postgres.service";

type AnalyzeResponse = Awaited<ReturnType<DocumentAnalysisService["analyze"]>>;

function createJob(
  data: AnalysisJobPayload,
  overrides: Partial<Pick<Job<AnalysisJobPayload>, "attemptsMade" | "opts">> = {},
): Job<AnalysisJobPayload> {
  return {
    id: "job-1",
    name: "analyze",
    data,
    attemptsMade: 0,
    opts: { attempts: 3 },
    ...overrides,
  } as unknown as Job<AnalysisJobPayload>;
}

function createMockProcessor(options: {
  analyzeResult: AnalyzeResponse;
  documentFilePath?: string | null;
}) {
  const mockClient = {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("SET LOCAL app.current_user_id")) {
        return { rowCount: 0, rows: [] };
      }

      if (sql.includes("FROM documents") && sql.includes("WHERE id = $1")) {
        const filePath = options.documentFilePath ?? "/uploads/test.pdf";
        return {
          rowCount: 1,
          rows: [
            {
              id: "doc-1",
              user_id: 0,
              filename: "test.pdf",
              mime_type: "application/pdf",
              size_bytes: 100,
              status: "uploaded",
              uploaded_at: new Date("2026-06-01T10:00:00.000Z"),
              file_path: filePath,
            },
          ],
        };
      }

      if (sql.includes("INSERT INTO entities")) {
        return { rowCount: 1, rows: [] };
      }

      if (sql.includes("SET extracted_text = $2")) {
        return { rowCount: 1, rows: [] };
      }

      if (sql.includes("retry_count = retry_count + 1")) {
        return {
          rowCount: 1,
          rows: [
            {
              id: "analysis-1",
              document_id: "doc-1",
              status: "failed",
              progress: 100,
              started_at: new Date("2026-06-01T10:00:00.000Z"),
              completed_at: null,
              retry_count: 1,
              error_message: params?.[1] ?? null,
              extracted_text: null,
            },
          ],
        };
      }

      if (sql.includes("SET status = $1")) {
        const status = (params?.[0] as string) ?? "completed";
        return {
          rowCount: 1,
          rows: [
            {
              id: "analysis-1",
              document_id: "doc-1",
              status,
              progress: 100,
              started_at: new Date("2026-06-01T10:00:00.000Z"),
              completed_at: status === "completed" ? new Date("2026-06-01T10:00:30.000Z") : null,
              retry_count: status === "failed" ? 1 : 0,
              error_message: null,
              extracted_text: null,
            },
          ],
        };
      }

      return { rowCount: 0, rows: [] };
    }),
    release: vi.fn(),
  } as unknown as PoolClient;

  const postgres = {
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

  const analyze = vi.fn(async () => options.analyzeResult);
  const documentAnalysisService = {
    analyze,
  } as unknown as DocumentAnalysisService;

  const processor = new AnalysisProcessor(postgres, documentAnalysisService);

  return {
    processor,
    analyze,
    postgres,
    query: (mockClient as PoolClient).query,
  };
}

describe("AnalysisProcessor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes job successfully, inserts entities, and marks analysis as completed", async () => {
    const { processor, analyze, query } = createMockProcessor({
      analyzeResult: {
        success: true,
        extractedText: "Extracted contract text",
        entities: [
          {
            label: "BUYER",
            value: "Jane Doe",
            group: "PARTIES",
            confidence: "HIGH",
            sourceSpan: { start: 0, end: 8 },
          },
        ],
      },
    });

    const job = createJob({
      analysisResultId: "analysis-1",
      documentId: "doc-1",
      ownerId: 0,
      filePath: "/uploads/test.pdf",
    });

    await processor.process(job);

    expect(analyze).toHaveBeenCalledWith("/uploads/test.pdf");
    expect(query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO entities"), expect.any(Array));
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("SET extracted_text = $2"),
      ["analysis-1", "Extracted contract text"],
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining("SET status = $1"), ["completed", "analysis-1"]);
  });

  it("rethrows retryable failures when attempts remain", async () => {
    const { processor, query } = createMockProcessor({
      analyzeResult: { success: false, error: "RATE_LIMIT: too many requests" },
    });

    const job = createJob(
      {
        analysisResultId: "analysis-1",
        documentId: "doc-1",
        ownerId: 0,
        filePath: "/uploads/test.pdf",
      },
      { attemptsMade: 0, opts: { attempts: 3 } },
    );

    await expect(processor.process(job)).rejects.toThrow("RATE_LIMIT: too many requests");
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining("retry_count = retry_count + 1"), expect.any(Array));
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining("SET status = $1"), ["failed", "analysis-1"]);
  });

  it("marks analysis as failed on terminal attempt", async () => {
    const { processor, query } = createMockProcessor({
      analyzeResult: { success: false, error: "RATE_LIMIT: too many requests" },
    });

    const job = createJob(
      {
        analysisResultId: "analysis-1",
        documentId: "doc-1",
        ownerId: 0,
        filePath: "/uploads/test.pdf",
      },
      { attemptsMade: 2, opts: { attempts: 3 } },
    );

    await processor.process(job);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("retry_count = retry_count + 1"),
      ["analysis-1", "RATE_LIMIT: too many requests"],
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining("SET status = $1"), ["failed", "analysis-1"]);
  });

  it("marks analysis as failed for non-retryable errors", async () => {
    const { processor, query } = createMockProcessor({
      analyzeResult: { success: false, error: "File not found" },
    });

    const job = createJob({
      analysisResultId: "analysis-1",
      documentId: "doc-1",
      ownerId: 0,
      filePath: "/uploads/test.pdf",
    });

    await processor.process(job);

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("retry_count = retry_count + 1"),
      ["analysis-1", "File not found"],
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining("SET status = $1"), ["failed", "analysis-1"]);
  });

  it("uses worker-fetched document path when payload filePath is null", async () => {
    const { processor, analyze } = createMockProcessor({
      analyzeResult: { success: true, extractedText: "text", entities: [] },
      documentFilePath: "/uploads/from-db.pdf",
    });

    const job = createJob({
      analysisResultId: "analysis-1",
      documentId: "doc-1",
      ownerId: 0,
      filePath: null,
    });

    await processor.process(job);

    expect(analyze).toHaveBeenCalledWith("/uploads/from-db.pdf");
  });
});
