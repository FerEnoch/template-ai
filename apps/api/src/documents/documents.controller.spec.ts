import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import type { DocumentRecord } from "../infrastructure/postgres/repositories/documents.repository";

// Mock the AI config module to avoid import-time env validation in unit tests
vi.mock("../config/ai.js", () => ({
  AI_CONFIG: {
    model: "google/gemini-2.5-flash:free",
    apiKey: "sk-or-test-key-123",
    maxTokens: 4096,
    temperature: 0.1,
  },
  UPLOAD_DIR: "/tmp/test-uploads",
}));

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

function makeMockFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: "contract.pdf",
    encoding: "7bit",
    mimetype: "application/pdf",
    destination: "/tmp/uploads",
    filename: "random-hash.pdf",
    path: "/tmp/uploads/random-hash.pdf",
    size: 1024,
    stream: process.stdout as never,
    buffer: Buffer.from("fake-pdf-content"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DocumentsController", () => {
  let service: DocumentsService;
  let controller: DocumentsController;

  beforeEach(() => {
    service = {
      upload: vi.fn(),
    } as unknown as DocumentsService;
    controller = new DocumentsController(service);
  });

  describe("POST /upload", () => {
    it("should accept a multipart file and return Document shape", async () => {
      const record = makeDocumentRecord();
      vi.spyOn(service, "upload").mockResolvedValue(record);

      const file = makeMockFile();
      const result = await controller.upload(file);

      expect(result).toEqual({
        id: record.id,
        filename: record.filename,
        mimeType: record.mimeType,
        sizeBytes: record.sizeBytes,
        status: record.status,
        uploadedAt: record.uploadedAt.toISOString(),
      });

      expect(service.upload).toHaveBeenCalledWith({
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        filePath: file.path,
      });
    });

    it("should throw BadRequestException when no file is provided", async () => {
      await expect(controller.upload(undefined as never)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.upload(undefined as never)).rejects.toThrow(
        "No file uploaded",
      );
    });

    it("should wrap service errors as InternalServerErrorException", async () => {
      vi.spyOn(service, "upload").mockRejectedValue(new Error("DB connection failed"));

      const file = makeMockFile();

      try {
        await controller.upload(file);
        throw new Error("Expected upload to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(InternalServerErrorException);
        expect((error as InternalServerErrorException).message).toBe(
          "Internal server error during file upload: DB connection failed",
        );
      }
    });

    it("should return Document with status 'processing' for a newly uploaded file", async () => {
      const record = makeDocumentRecord({ status: "processing" });
      vi.spyOn(service, "upload").mockResolvedValue(record);

      const file = makeMockFile();
      const result = await controller.upload(file);

      expect(result.status).toBe("processing");
    });

    it("should pass correct metadata from file to service for a DOCX upload", async () => {
      const record = makeDocumentRecord({
        filename: "report.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 5242880,
      });
      vi.spyOn(service, "upload").mockResolvedValue(record);

      const file = makeMockFile({
        originalname: "report.docx",
        mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 5242880,
      });

      const result = await controller.upload(file);

      expect(service.upload).toHaveBeenCalledWith({
        filename: "report.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 5242880,
        filePath: file.path,
      });

      // Verify response reflects actual file metadata, not hardcoded values
      expect(result.filename).toBe("report.docx");
      expect(result.mimeType).toBe(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      expect(result.sizeBytes).toBe(5242880);
    });
  });
});