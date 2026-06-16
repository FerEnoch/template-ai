import { describe, it, expect } from "vitest";
import {
  CaseStatus,
  CaseSchema,
  CreateCaseRequestSchema,
  UpdateCaseFormDataSchema,
  GenerateDocumentResponseSchema,
  ExportRequestSchema,
} from "../schemas.js";

describe("CaseStatus", () => {
  it.each(["borrador", "generado", "exportado", "archivado"])(
    "accepts valid status: %s",
    (status) => {
      const result = CaseStatus.safeParse(status);
      expect(result.success).toBe(true);
    },
  );

  it("rejects invalid status", () => {
    const result = CaseStatus.safeParse("invalid_status");
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = CaseStatus.safeParse("");
    expect(result.success).toBe(false);
  });
});

describe("CaseSchema", () => {
  const validCase = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    userId: 1,
    templateId: "660e8400-e29b-41d4-a716-446655440001",
    status: "borrador" as const,
    formData: { ent_1: "Juan Pérez" },
    generatedText: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };

  it("parses a valid case with all fields", () => {
    const result = CaseSchema.safeParse(validCase);
    expect(result.success).toBe(true);
  });

  it("accepts generatedText as null", () => {
    const result = CaseSchema.safeParse({
      ...validCase,
      generatedText: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.generatedText).toBeNull();
    }
  });

  it("accepts generatedText as a string", () => {
    const result = CaseSchema.safeParse({
      ...validCase,
      generatedText: "Full legal document text...",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.generatedText).toBe("Full legal document text...");
    }
  });

  it("accepts empty formData", () => {
    const result = CaseSchema.safeParse({
      ...validCase,
      formData: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects case missing required id", () => {
    const { id, ...withoutId } = validCase;
    const result = CaseSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it("rejects case with invalid uuid", () => {
    const result = CaseSchema.safeParse({
      ...validCase,
      id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects case with invalid status", () => {
    const result = CaseSchema.safeParse({
      ...validCase,
      status: "deleted",
    });
    expect(result.success).toBe(false);
  });

  it("rejects case with non-datetime createdAt", () => {
    const result = CaseSchema.safeParse({
      ...validCase,
      createdAt: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

describe("CreateCaseRequestSchema", () => {
  it("parses a valid create request", () => {
    const result = CreateCaseRequestSchema.safeParse({
      templateId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing templateId", () => {
    const result = CreateCaseRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects invalid uuid templateId", () => {
    const result = CreateCaseRequestSchema.safeParse({
      templateId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});

describe("UpdateCaseFormDataSchema", () => {
  it("parses a valid formData update", () => {
    const result = UpdateCaseFormDataSchema.safeParse({
      formData: { ent_1: "Juan Pérez" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional status for archiving", () => {
    const result = UpdateCaseFormDataSchema.safeParse({
      formData: { ent_1: "Juan Pérez" },
      status: "archivado",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status in update", () => {
    const result = UpdateCaseFormDataSchema.safeParse({
      formData: {},
      status: "deleted",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-string values in formData", () => {
    const result = UpdateCaseFormDataSchema.safeParse({
      formData: { ent_1: 123 },
    });
    expect(result.success).toBe(false);
  });
});

describe("GenerateDocumentResponseSchema", () => {
  it("parses a valid response with generated text", () => {
    const result = GenerateDocumentResponseSchema.safeParse({
      generatedText: "Full legal document content...",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty generatedText", () => {
    const result = GenerateDocumentResponseSchema.safeParse({
      generatedText: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing generatedText", () => {
    const result = GenerateDocumentResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("ExportRequestSchema", () => {
  it("accepts pdf format", () => {
    const result = ExportRequestSchema.safeParse({ format: "pdf" });
    expect(result.success).toBe(true);
  });

  it("accepts docx format", () => {
    const result = ExportRequestSchema.safeParse({ format: "docx" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid format", () => {
    const result = ExportRequestSchema.safeParse({ format: "html" });
    expect(result.success).toBe(false);
  });

  it("rejects missing format", () => {
    const result = ExportRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
