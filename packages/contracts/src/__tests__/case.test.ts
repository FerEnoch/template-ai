import { describe, it, expect } from "vitest";
import {
  CaseStatus,
  CaseSchema,
  CaseFormDraftSchema,
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

  it("accepts contentTitle as a string", () => {
    const result = CaseSchema.safeParse({
      ...validCase,
      contentTitle: "Compraventa",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentTitle).toBe("Compraventa");
    }
  });

  it("accepts contentTitle as null", () => {
    const result = CaseSchema.safeParse({
      ...validCase,
      contentTitle: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentTitle).toBeNull();
    }
  });

  it("accepts missing contentTitle", () => {
    const result = CaseSchema.safeParse(validCase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentTitle).toBeUndefined();
    }
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

  it("accepts optional name for renaming", () => {
    const result = UpdateCaseFormDataSchema.safeParse({
      name: "Renamed Case",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Renamed Case");
    }
  });

  it("accepts name as null", () => {
    const result = UpdateCaseFormDataSchema.safeParse({
      name: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBeNull();
    }
  });

  it("rejects a name over 200 characters", () => {
    const result = UpdateCaseFormDataSchema.safeParse({
      name: "a".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional contentTitle for renaming", () => {
    const result = UpdateCaseFormDataSchema.safeParse({
      contentTitle: "Compraventa",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentTitle).toBe("Compraventa");
    }
  });

  it("accepts contentTitle as null", () => {
    const result = UpdateCaseFormDataSchema.safeParse({
      contentTitle: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentTitle).toBeNull();
    }
  });

  it("accepts PATCH with contentTitle", () => {
    const result = UpdateCaseFormDataSchema.safeParse({
      contentTitle: "X",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentTitle).toBe("X");
    }
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

describe("CaseFormDraftSchema", () => {
  const validDraft = {
    caseId: "550e8400-e29b-41d4-a716-446655440000",
    templateId: "660e8400-e29b-41d4-a716-446655440001",
    formData: { "ent-1": "Juan Pérez" },
    savedAt: "2025-01-01T00:00:00.000Z",
  };

  it("parses a valid case form draft", () => {
    const result = CaseFormDraftSchema.safeParse(validDraft);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.caseId).toBe(validDraft.caseId);
      expect(result.data.templateId).toBe(validDraft.templateId);
      expect(result.data.formData).toEqual(validDraft.formData);
      expect(result.data.savedAt).toBe(validDraft.savedAt);
    }
  });

  it("accepts empty formData", () => {
    const result = CaseFormDraftSchema.safeParse({
      ...validDraft,
      formData: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing caseId", () => {
    const { caseId, ...withoutCaseId } = validDraft;
    const result = CaseFormDraftSchema.safeParse(withoutCaseId);
    expect(result.success).toBe(false);
  });

  it("rejects missing templateId", () => {
    const { templateId, ...withoutTemplateId } = validDraft;
    const result = CaseFormDraftSchema.safeParse(withoutTemplateId);
    expect(result.success).toBe(false);
  });

  it("rejects missing formData", () => {
    const { formData, ...withoutFormData } = validDraft;
    const result = CaseFormDraftSchema.safeParse(withoutFormData);
    expect(result.success).toBe(false);
  });

  it("rejects missing savedAt", () => {
    const { savedAt, ...withoutSavedAt } = validDraft;
    const result = CaseFormDraftSchema.safeParse(withoutSavedAt);
    expect(result.success).toBe(false);
  });

  it("rejects non-string formData values", () => {
    const result = CaseFormDraftSchema.safeParse({
      ...validDraft,
      formData: { "ent-1": 123 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid uuid caseId", () => {
    const result = CaseFormDraftSchema.safeParse({
      ...validDraft,
      caseId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});
