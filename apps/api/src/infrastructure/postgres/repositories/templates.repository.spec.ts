import { describe, it, expect, vi } from "vitest";
import type { PoolClient } from "pg";

import {
  TemplatesRepository,
  type TemplateRecord,
  type CreateTemplateInput,
} from "./templates.repository.js";

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
  user_id: 1,
  name: "Contrato de Arrendamiento",
  description: "Plantilla para contratos de arrendamiento",
  document_id: "660e8400-e29b-41d4-a716-446655440001",
  category: "legal",
  status: "draft",
  entities: [
    { id: "e1", label: "Parte", value: "Juan", group: "PARTES", confidence: "ALTA", reviewed: false, excluded: false },
  ],
  created_at: new Date("2025-01-01T00:00:00Z"),
};

const sampleInput: CreateTemplateInput = {
  userId: 1,
  name: "Contrato de Arrendamiento",
  documentId: "660e8400-e29b-41d4-a716-446655440001",
  category: "legal",
  entities: [
    { id: "e1", label: "Parte", value: "Juan", group: "PARTES", confidence: "ALTA", reviewed: false, excluded: false },
  ],
  description: "Plantilla para contratos de arrendamiento",
};

describe("TemplatesRepository", () => {
  let repo: TemplatesRepository;

  describe("create", () => {
    it("inserts a template and returns mapped record", async () => {
      const { client, querySpy } = mockPoolClient([sampleRow]);
      repo = new TemplatesRepository(client);

      const result = await repo.create(sampleInput);

      expect(result).toEqual({
        id: "550e8400-e29b-41d4-a716-446655440000",
        userId: 1,
        name: "Contrato de Arrendamiento",
        description: "Plantilla para contratos de arrendamiento",
        documentId: "660e8400-e29b-41d4-a716-446655440001",
        category: "legal",
        status: "draft",
        entities: expect.any(Array),
        createdAt: new Date("2025-01-01T00:00:00Z"),
      } satisfies TemplateRecord);

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO templates"),
        expect.arrayContaining([
          1,
          "Contrato de Arrendamiento",
          "660e8400-e29b-41d4-a716-446655440001",
          "legal",
        ]),
      );
    });

    it("throws when insertion returns no rows", async () => {
      const { client } = mockPoolClient([]);
      repo = new TemplatesRepository(client);

      await expect(repo.create(sampleInput)).rejects.toThrow(
        "Failed to insert template",
      );
    });
  });

  describe("findById", () => {
    it("returns a template when found", async () => {
      const { client } = mockPoolClient([sampleRow]);
      repo = new TemplatesRepository(client);

      const result = await repo.findById("550e8400-e29b-41d4-a716-446655440000");
      expect(result).toEqual(expect.objectContaining({ name: "Contrato de Arrendamiento" }));
    });

    it("returns null when not found", async () => {
      const { client } = mockPoolClient([]);
      repo = new TemplatesRepository(client);

      const result = await repo.findById("00000000-0000-0000-0000-000000000000");
      expect(result).toBeNull();
    });
  });

  describe("findByUserId", () => {
    it("returns all templates for a user ordered by creation date", async () => {
      const row2 = {
        ...sampleRow,
        id: "660e8400-e29b-41d4-a716-446655440099",
        name: "Otro Contrato",
      };
      const { client } = mockPoolClient([sampleRow, row2]);
      repo = new TemplatesRepository(client);

      const result = await repo.findByUserId(1);
      expect(result).toEqual([
        expect.objectContaining({ name: "Contrato de Arrendamiento" }),
        expect.objectContaining({ name: "Otro Contrato" }),
      ]);
    });

    it("returns empty array when user has no templates", async () => {
      const { client } = mockPoolClient([]);
      repo = new TemplatesRepository(client);

      const result = await repo.findByUserId(999);
      expect(result).toEqual([]);
    });
  });

  describe("findByNameAndUserId", () => {
    it("returns a template when name+userId match exists", async () => {
      const { client, querySpy } = mockPoolClient([sampleRow]);
      repo = new TemplatesRepository(client);

      const result = await repo.findByNameAndUserId("Contrato de Arrendamiento", 1);
      expect(result).toEqual(expect.objectContaining({ name: "Contrato de Arrendamiento" }));
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("WHERE name = $1 AND user_id = $2"),
        ["Contrato de Arrendamiento", 1],
      );
    });

    it("returns null when no matching name+userId exists", async () => {
      const { client } = mockPoolClient([]);
      repo = new TemplatesRepository(client);

      const result = await repo.findByNameAndUserId("Nonexistent", 999);
      expect(result).toBeNull();
    });
  });

  describe("updateStatus", () => {
    it("updates status and returns updated record", async () => {
      const updatedRow = { ...sampleRow, status: "published" };
      const { client, querySpy } = mockPoolClient([updatedRow]);
      repo = new TemplatesRepository(client);

      const result = await repo.updateStatus(
        "550e8400-e29b-41d4-a716-446655440000",
        "published",
      );

      expect(result).toEqual(expect.objectContaining({ status: "published" }));
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE templates"),
        ["published", "550e8400-e29b-41d4-a716-446655440000"],
      );
    });

    it("returns null when template not found for update", async () => {
      const { client } = mockPoolClient([]);
      repo = new TemplatesRepository(client);

      const result = await repo.updateStatus(
        "00000000-0000-0000-0000-000000000000",
        "published",
      );
      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("deletes a template and returns true when found", async () => {
      const { client, querySpy } = mockPoolClient([sampleRow]);
      repo = new TemplatesRepository(client);

      const result = await repo.delete("550e8400-e29b-41d4-a716-446655440000");
      expect(result).toBe(true);
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM templates"),
        ["550e8400-e29b-41d4-a716-446655440000"],
      );
    });

    it("returns false when template not found", async () => {
      const { client } = mockPoolClient([]);
      repo = new TemplatesRepository(client);

      const result = await repo.delete("00000000-0000-0000-0000-000000000000");
      expect(result).toBe(false);
    });
  });
});