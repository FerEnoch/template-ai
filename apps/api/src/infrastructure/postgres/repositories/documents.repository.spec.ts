import { describe, it, expect, vi } from "vitest";
import type { PoolClient } from "pg";

import {
  DocumentsRepository,
  type DocumentRecord,
  type CreateDocumentInput,
} from "./documents.repository.js";

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
  filename: "contract.pdf",
  mime_type: "application/pdf",
  size_bytes: 1024,
  status: "processing",
  uploaded_at: new Date("2025-01-01T00:00:00Z"),
  file_path: null,
};

const sampleInput: CreateDocumentInput = {
  userId: 1,
  filename: "contract.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024,
};

describe("DocumentsRepository", () => {
  let repo: DocumentsRepository;

  describe("create", () => {
    it("inserts a document and returns mapped record", async () => {
      const { client, querySpy } = mockPoolClient([sampleRow]);
      repo = new DocumentsRepository(client);

      const result = await repo.create(sampleInput);

      expect(result).toEqual({
        id: "550e8400-e29b-41d4-a716-446655440000",
        userId: 1,
        filename: "contract.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        status: "processing",
        uploadedAt: new Date("2025-01-01T00:00:00Z"),
        filePath: null,
      } satisfies DocumentRecord);

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO documents"),
        [1, "contract.pdf", "application/pdf", 1024, null],
      );
    });

    it("throws when insertion returns no rows", async () => {
      const { client } = mockPoolClient([]);
      repo = new DocumentsRepository(client);

      await expect(repo.create(sampleInput)).rejects.toThrow(
        "Failed to insert document",
      );
    });

    it("inserts a document with filePath and returns mapped record", async () => {
      const rowWithFilePath = { ...sampleRow, file_path: "/uploads/abc-123.pdf" };
      const { client, querySpy } = mockPoolClient([rowWithFilePath]);
      repo = new DocumentsRepository(client);

      const inputWithFilePath: CreateDocumentInput = {
        ...sampleInput,
        filePath: "/uploads/abc-123.pdf",
      };
      const result = await repo.create(inputWithFilePath);

      expect(result).toEqual({
        id: "550e8400-e29b-41d4-a716-446655440000",
        userId: 1,
        filename: "contract.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        status: "processing",
        uploadedAt: new Date("2025-01-01T00:00:00Z"),
        filePath: "/uploads/abc-123.pdf",
      } satisfies DocumentRecord);

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO documents"),
        [1, "contract.pdf", "application/pdf", 1024, "/uploads/abc-123.pdf"],
      );
    });
  });

  describe("findById", () => {
    it("returns a document when found", async () => {
      const { client } = mockPoolClient([sampleRow]);
      repo = new DocumentsRepository(client);

      const result = await repo.findById("550e8400-e29b-41d4-a716-446655440000");

      expect(result).toEqual({
        id: "550e8400-e29b-41d4-a716-446655440000",
        userId: 1,
        filename: "contract.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        status: "processing",
        uploadedAt: new Date("2025-01-01T00:00:00Z"),
        filePath: null,
      });
    });

    it("returns null when not found", async () => {
      const { client } = mockPoolClient([]);
      repo = new DocumentsRepository(client);

      const result = await repo.findById("00000000-0000-0000-0000-000000000000");
      expect(result).toBeNull();
    });
  });

  describe("findByUserId", () => {
    it("returns all documents for a user", async () => {
      const row2: Record<string, unknown> = {
        ...sampleRow,
        id: "660e8400-e29b-41d4-a716-446655440001",
        filename: "letter.docx",
      };
      const { client } = mockPoolClient([sampleRow, row2]);
      repo = new DocumentsRepository(client);

      const result = await repo.findByUserId(1);

      expect(result).toEqual([
        expect.objectContaining({ filename: "contract.pdf" }),
        expect.objectContaining({ filename: "letter.docx" }),
      ]);
    });

    it("returns empty array when user has no documents", async () => {
      const { client } = mockPoolClient([]);
      repo = new DocumentsRepository(client);

      const result = await repo.findByUserId(999);
      expect(result).toEqual([]);
    });
  });

  describe("updateStatus", () => {
    it("updates status and returns updated record", async () => {
      const updatedRow = { ...sampleRow, status: "completed" };
      const { client, querySpy } = mockPoolClient([updatedRow]);
      repo = new DocumentsRepository(client);

      const result = await repo.updateStatus(
        "550e8400-e29b-41d4-a716-446655440000",
        "completed",
      );

      expect(result).toEqual(expect.objectContaining({ status: "completed" }));
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE documents"),
        ["completed", "550e8400-e29b-41d4-a716-446655440000"],
      );
    });

    it("returns null when document not found for update", async () => {
      const { client } = mockPoolClient([]);
      repo = new DocumentsRepository(client);

      const result = await repo.updateStatus(
        "00000000-0000-0000-0000-000000000000",
        "completed",
      );
      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    it("deletes a document and returns true when found", async () => {
      const { client, querySpy } = mockPoolClient([sampleRow]);
      repo = new DocumentsRepository(client);

      const result = await repo.delete("550e8400-e29b-41d4-a716-446655440000");
      expect(result).toBe(true);
      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM documents"),
        ["550e8400-e29b-41d4-a716-446655440000"],
      );
    });

    it("returns false when document not found", async () => {
      const { client } = mockPoolClient([]);
      repo = new DocumentsRepository(client);

      const result = await repo.delete("00000000-0000-0000-0000-000000000000");
      expect(result).toBe(false);
    });
  });
});