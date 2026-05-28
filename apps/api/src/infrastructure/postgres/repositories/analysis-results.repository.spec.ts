import { describe, it, expect, vi } from "vitest";
import type { PoolClient } from "pg";

import {
  AnalysisResultsRepository,
  type AnalysisResultRecord,
  type CreateAnalysisResultInput,
} from "./analysis-results.repository.js";

function mockPoolClient(queryResult: Record<string, unknown>[] = []): {
  client: PoolClient;
  querySpy: ReturnType<typeof vi.fn>;
} {
  const querySpy = vi.fn().mockResolvedValue({
    rows: queryResult,
    rowCount: queryResult.length,
  });
  const client = {
    query: querySpy,
    release: vi.fn(),
  } as unknown as PoolClient;
  return { client, querySpy };
}

const sampleRow: Record<string, unknown> = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  document_id: "660e8400-e29b-41d4-a716-446655440001",
  status: "processing",
  progress: 0,
  started_at: new Date("2025-01-01T00:00:00Z"),
  completed_at: null,
};

const sampleInput: CreateAnalysisResultInput = {
  documentId: "660e8400-e29b-41d4-a716-446655440001",
  status: "processing",
};

describe("AnalysisResultsRepository", () => {
  let repo: AnalysisResultsRepository;

  describe("create", () => {
    it("inserts an analysis result and returns mapped record", async () => {
      const { client, querySpy } = mockPoolClient([sampleRow]);
      repo = new AnalysisResultsRepository(client);

      const result = await repo.create(sampleInput);

      expect(result).toEqual({
        id: "550e8400-e29b-41d4-a716-446655440000",
        documentId: "660e8400-e29b-41d4-a716-446655440001",
        status: "processing",
        progress: 0,
        startedAt: new Date("2025-01-01T00:00:00Z"),
        completedAt: null,
      } satisfies AnalysisResultRecord);

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO analysis_results"),
        ["660e8400-e29b-41d4-a716-446655440001", "processing"],
      );
    });

    it("throws when insertion returns no rows", async () => {
      const { client } = mockPoolClient([]);
      repo = new AnalysisResultsRepository(client);

      await expect(repo.create(sampleInput)).rejects.toThrow(
        "Failed to insert analysis result",
      );
    });
  });

  describe("findById", () => {
    it("returns an analysis result when found", async () => {
      const { client } = mockPoolClient([sampleRow]);
      repo = new AnalysisResultsRepository(client);

      const result = await repo.findById("550e8400-e29b-41d4-a716-446655440000");
      expect(result).toEqual(expect.objectContaining({ progress: 0 }));
    });

    it("returns null when not found", async () => {
      const { client } = mockPoolClient([]);
      repo = new AnalysisResultsRepository(client);

      const result = await repo.findById("00000000-0000-0000-0000-000000000000");
      expect(result).toBeNull();
    });
  });

  describe("findByDocumentId", () => {
    it("returns analysis results for a given document", async () => {
      const { client } = mockPoolClient([sampleRow]);
      repo = new AnalysisResultsRepository(client);

      const result = await repo.findByDocumentId("660e8400-e29b-41d4-a716-446655440001");
      expect(result).toEqual([expect.objectContaining({ progress: 0 })]);
    });

    it("returns empty array when no results exist for document", async () => {
      const { client } = mockPoolClient([]);
      repo = new AnalysisResultsRepository(client);

      const result = await repo.findByDocumentId("00000000-0000-0000-0000-000000000000");
      expect(result).toEqual([]);
    });
  });

  describe("incrementProgress", () => {
    it("increments progress by 25, capped at 100, and returns updated record", async () => {
      const updatedRow = { ...sampleRow, progress: 25 };
      const { client, querySpy } = mockPoolClient([updatedRow]);
      repo = new AnalysisResultsRepository(client);

      const result = await repo.incrementProgress(
        "550e8400-e29b-41d4-a716-446655440000",
      );

      expect(result).toEqual(expect.objectContaining({ progress: 25 }));
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("LEAST(progress + 25, 100)"),
        ["550e8400-e29b-41d4-a716-446655440000"],
      );
    });

    it("caps progress at 100 when already at 80+", async () => {
      const cappedRow = { ...sampleRow, progress: 100 };
      const { client } = mockPoolClient([cappedRow]);
      repo = new AnalysisResultsRepository(client);

      const result = await repo.incrementProgress("550e8400-e29b-41d4-a716-446655440000");
      expect(result).toEqual(expect.objectContaining({ progress: 100 }));
    });

    it("returns null when analysis result not found for update", async () => {
      const { client } = mockPoolClient([]);
      repo = new AnalysisResultsRepository(client);

      const result = await repo.incrementProgress("00000000-0000-0000-0000-000000000000");
      expect(result).toBeNull();
    });
  });

  describe("updateStatus", () => {
    it("updates status and returns updated record", async () => {
      const completedRow = {
        ...sampleRow,
        status: "completed",
        completed_at: new Date("2025-01-01T01:00:00Z"),
      };
      const { client, querySpy } = mockPoolClient([completedRow]);
      repo = new AnalysisResultsRepository(client);

      const result = await repo.updateStatus(
        "550e8400-e29b-41d4-a716-446655440000",
        "completed",
      );

      expect(result).toEqual(expect.objectContaining({ status: "completed" }));
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE analysis_results"),
        ["completed", "550e8400-e29b-41d4-a716-446655440000"],
      );
    });

    it("returns null when not found for update", async () => {
      const { client } = mockPoolClient([]);
      repo = new AnalysisResultsRepository(client);

      const result = await repo.updateStatus(
        "00000000-0000-0000-0000-000000000000",
        "completed",
      );
      expect(result).toBeNull();
    });
  });
});