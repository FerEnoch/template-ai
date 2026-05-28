import { describe, it, expect, vi } from "vitest";
import type { PoolClient } from "pg";

import {
  EntitiesRepository,
  type EntityRecord,
  type CreateEntityInput,
} from "./entities.repository.js";

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
  analysis_result_id: "660e8400-e29b-41d4-a716-446655440001",
  document_id: "770e8400-e29b-41d4-a716-446655440002",
  label: "Parte Actora",
  value: "Juan Pérez",
  group: "PARTES",
  confidence: "ALTA",
  source_span: { start: 0, end: 10 },
  reviewed: false,
  excluded: false,
};

const sampleInput: CreateEntityInput = {
  analysisResultId: "660e8400-e29b-41d4-a716-446655440001",
  documentId: "770e8400-e29b-41d4-a716-446655440002",
  label: "Parte Actora",
  value: "Juan Pérez",
  group: "PARTES",
  confidence: "ALTA",
  sourceSpan: { start: 0, end: 10 },
};

describe("EntitiesRepository", () => {
  let repo: EntitiesRepository;

  describe("create", () => {
    it("inserts an entity and returns mapped record", async () => {
      const { client, querySpy } = mockPoolClient([sampleRow]);
      repo = new EntitiesRepository(client);

      const result = await repo.create(sampleInput);

      expect(result).toEqual({
        id: "550e8400-e29b-41d4-a716-446655440000",
        analysisResultId: "660e8400-e29b-41d4-a716-446655440001",
        documentId: "770e8400-e29b-41d4-a716-446655440002",
        label: "Parte Actora",
        value: "Juan Pérez",
        group: "PARTES",
        confidence: "ALTA",
        sourceSpan: { start: 0, end: 10 },
        reviewed: false,
        excluded: false,
      } satisfies EntityRecord);

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO entities"),
        expect.arrayContaining([
          "660e8400-e29b-41d4-a716-446655440001",
          "770e8400-e29b-41d4-a716-446655440002",
          "Parte Actora",
          "Juan Pérez",
          "PARTES",
          "ALTA",
        ]),
      );
    });

    it("inserts an entity without sourceSpan (null)", async () => {
      const rowNoSpan = { ...sampleRow, source_span: null };
      const { client } = mockPoolClient([rowNoSpan]);
      repo = new EntitiesRepository(client);

      const inputNoSpan: CreateEntityInput = {
        ...sampleInput,
        sourceSpan: undefined,
      };

      const result = await repo.create(inputNoSpan);
      expect(result).toEqual(expect.objectContaining({ sourceSpan: null }));
    });

    it("throws when insertion returns no rows", async () => {
      const { client } = mockPoolClient([]);
      repo = new EntitiesRepository(client);

      await expect(repo.create(sampleInput)).rejects.toThrow(
        "Failed to insert entity",
      );
    });
  });

  describe("bulkInsert", () => {
    it("inserts multiple entities and returns mapped records", async () => {
      const row2: Record<string, unknown> = {
        ...sampleRow,
        id: "550e8400-e29b-41d4-a716-446655440099",
        label: "Inmueble",
        value: "Calle 123",
        group: "INMUEBLE",
      };
      const { client, querySpy } = mockPoolClient([sampleRow, row2]);
      repo = new EntitiesRepository(client);

      const inputs: CreateEntityInput[] = [
        sampleInput,
        {
          ...sampleInput,
          label: "Inmueble",
          value: "Calle 123",
          group: "INMUEBLE",
        },
      ];

      const result = await repo.bulkInsert(inputs);

      expect(result).toEqual([
        expect.objectContaining({ label: "Parte Actora" }),
        expect.objectContaining({ label: "Inmueble" }),
      ]);
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO entities"),
        expect.any(Array),
      );
    });

    it("returns empty array when inputs are empty", async () => {
      const { client, querySpy } = mockPoolClient([]);
      repo = new EntitiesRepository(client);

      const result = await repo.bulkInsert([]);
      expect(result).toEqual([]);
      expect(querySpy).not.toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    it("returns an entity when found", async () => {
      const { client } = mockPoolClient([sampleRow]);
      repo = new EntitiesRepository(client);

      const result = await repo.findById("550e8400-e29b-41d4-a716-446655440000");
      expect(result).toEqual(expect.objectContaining({ label: "Parte Actora" }));
    });

    it("returns null when not found", async () => {
      const { client } = mockPoolClient([]);
      repo = new EntitiesRepository(client);

      const result = await repo.findById("00000000-0000-0000-0000-000000000000");
      expect(result).toBeNull();
    });
  });

  describe("findByAnalysisResultId", () => {
    it("returns all entities for an analysis result", async () => {
      const { client } = mockPoolClient([sampleRow]);
      repo = new EntitiesRepository(client);

      const result = await repo.findByAnalysisResultId(
        "660e8400-e29b-41d4-a716-446655440001",
      );
      expect(result).toEqual([expect.objectContaining({ group: "PARTES" })]);
    });

    it("returns empty array when no entities exist", async () => {
      const { client } = mockPoolClient([]);
      repo = new EntitiesRepository(client);

      const result = await repo.findByAnalysisResultId(
        "00000000-0000-0000-0000-000000000000",
      );
      expect(result).toEqual([]);
    });
  });

  describe("update", () => {
    it("updates entity fields and returns updated record", async () => {
      const updatedRow = { ...sampleRow, reviewed: true, excluded: true };
      const { client, querySpy } = mockPoolClient([updatedRow]);
      repo = new EntitiesRepository(client);

      const result = await repo.update("550e8400-e29b-41d4-a716-446655440000", {
        reviewed: true,
        excluded: true,
      });

      expect(result).toEqual(expect.objectContaining({ reviewed: true, excluded: true }));
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE entities"),
        expect.arrayContaining(["550e8400-e29b-41d4-a716-446655440000"]),
      );
    });

    it("returns null when entity not found for update", async () => {
      const { client } = mockPoolClient([]);
      repo = new EntitiesRepository(client);

      const result = await repo.update("00000000-0000-0000-0000-000000000000", {
        reviewed: true,
      });
      expect(result).toBeNull();
    });
  });

  describe("deleteByDocumentId", () => {
    it("deletes entities by document_id and returns count", async () => {
      const { client, querySpy } = mockPoolClient([]);
      querySpy.mockResolvedValueOnce({
        rows: [],
        rowCount: 3,
      });
      repo = new EntitiesRepository(client);

      const count = await repo.deleteByDocumentId(
        "770e8400-e29b-41d4-a716-446655440002",
      );
      expect(count).toBe(3);
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM entities"),
        ["770e8400-e29b-41d4-a716-446655440002"],
      );
    });
  });
});