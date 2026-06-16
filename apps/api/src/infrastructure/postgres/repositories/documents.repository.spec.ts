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
  content_hash: null,
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
        contentHash: null,
      } satisfies DocumentRecord);

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO documents"),
        [1, "contract.pdf", "application/pdf", 1024, null, null],
      );
    });

    it("throws when insertion returns no rows", async () => {
      const { client } = mockPoolClient([]);
      repo = new DocumentsRepository(client);

      await expect(repo.create(sampleInput)).rejects.toThrow(
        "Failed to insert document",
      );
    });

    it("inserts a document with filePath and contentHash", async () => {
      const rowWithHash = { ...sampleRow, file_path: "/uploads/abc-123.pdf", content_hash: "abc123hash" };
      const { client, querySpy } = mockPoolClient([rowWithHash]);
      repo = new DocumentsRepository(client);

      const inputWithHash: CreateDocumentInput = {
        ...sampleInput,
        filePath: "/uploads/abc-123.pdf",
        contentHash: "abc123hash",
      };
      const result = await repo.create(inputWithHash);

      expect(result).toEqual({
        id: "550e8400-e29b-41d4-a716-446655440000",
        userId: 1,
        filename: "contract.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        status: "processing",
        uploadedAt: new Date("2025-01-01T00:00:00Z"),
        filePath: "/uploads/abc-123.pdf",
        contentHash: "abc123hash",
      } satisfies DocumentRecord);

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO documents"),
        [1, "contract.pdf", "application/pdf", 1024, "/uploads/abc-123.pdf", "abc123hash"],
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
        contentHash: null,
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

  describe("findByContentHashWithCompletedAnalysis", () => {
    it("returns document + analysis + entities when a completed analysis exists", async () => {
      const completedRow = {
        ...sampleRow,
        content_hash: "sha256hash",
        analysis_result_id: "ar-001",
      };
      const entityRow: Record<string, unknown> = {
        id: "ent-001",
        analysis_result_id: "ar-001",
        document_id: sampleRow.id,
        label: "Company",
        value: "Acme Corp",
        group: "organization",
        confidence: "0.95",
        source_span: null,
        reviewed: false,
        excluded: false,
        user_created: false,
      };

      const querySpy = vi.fn()
        .mockResolvedValueOnce({ rows: [completedRow], rowCount: 1 }) // JOIN query
        .mockResolvedValueOnce({ rows: [entityRow], rowCount: 1 }); // entities query

      const client = { query: querySpy, release: vi.fn() } as unknown as PoolClient;
      repo = new DocumentsRepository(client);

      const result = await repo.findByContentHashWithCompletedAnalysis("sha256hash");

      expect(result).not.toBeNull();
      expect(result!.document.contentHash).toBe("sha256hash");
      expect(result!.analysisResultId).toBe("ar-001");
      expect(result!.entities).toHaveLength(1);
      expect(result!.entities[0].label).toBe("Company");

      expect(querySpy).toHaveBeenCalledWith(
        expect.stringContaining("content_hash = $1"),
        ["sha256hash"],
      );
    });

    it("returns null when no completed analysis exists for the hash", async () => {
      const { client } = mockPoolClient([]);
      repo = new DocumentsRepository(client);

      const result = await repo.findByContentHashWithCompletedAnalysis("nonexistent");
      expect(result).toBeNull();
    });

    it("returns null when analysis exists but status is not completed", async () => {
      // The JOIN query filters by status='completed', so a processing row won't match
      const { client } = mockPoolClient([]);
      repo = new DocumentsRepository(client);

      const result = await repo.findByContentHashWithCompletedAnalysis("processing-hash");
      expect(result).toBeNull();
    });
  });
});