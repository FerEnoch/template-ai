import { describe, it, expect } from "vitest";
import {
  AnalysisResultSchema,
  EntitySchema,
  WizardDraftSchema,
  ClassifySpanRequestSchema,
  ClassifySpanResponseSchema,
  UploadResponseSchema,
  MANUAL_ENTITY_LIMIT,
} from "./schemas.js";

describe("EntitySchema", () => {
  const validEntity = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    label: "COMPRADOR",
    value: "María González López",
    group: "PARTES" as const,
    confidence: "ALTA" as const,
    reviewed: false,
  };

  it("parses a valid entity with all fields", () => {
    const result = EntitySchema.safeParse({
      ...validEntity,
      excluded: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.excluded).toBe(true);
    }
  });

  it("parses a valid entity without excluded field", () => {
    const result = EntitySchema.safeParse(validEntity);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.excluded).toBe(false);
    }
  });

  it("defaults excluded to false", () => {
    const result = EntitySchema.safeParse(validEntity);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.excluded).toBe(false);
    }
  });

  it("rejects an entity missing required fields", () => {
    const result = EntitySchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      // missing label
      value: "some value",
      group: "PARTES",
      confidence: "ALTA",
    });
    expect(result.success).toBe(false);
  });

  it("accepts excluded: true explicitly", () => {
    const result = EntitySchema.safeParse({
      ...validEntity,
      excluded: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.excluded).toBe(true);
    }
  });
});

describe("AnalysisResultSchema", () => {
  const validResult = {
    documentId: "550e8400-e29b-41d4-a716-446655440000",
    status: "completed" as const,
    entities: [],
    progress: 100,
    extractedText: null,
  };

  it("accepts extractedText as null (legacy documents)", () => {
    const result = AnalysisResultSchema.safeParse(validResult);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.extractedText).toBeNull();
    }
  });

  it("accepts extractedText as a string", () => {
    const result = AnalysisResultSchema.safeParse({
      ...validResult,
      extractedText: "Cláusula primera: El comprador adquiere el inmueble...",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.extractedText).toBe(
        "Cláusula primera: El comprador adquiere el inmueble...",
      );
    }
  });

  it("rejects when extractedText is missing", () => {
    const { extractedText, ...withoutText } = validResult;
    const result = AnalysisResultSchema.safeParse(withoutText);
    expect(result.success).toBe(false);
  });

  it("rejects when extractedText is a number", () => {
    const result = AnalysisResultSchema.safeParse({
      ...validResult,
      extractedText: 123,
    });
    expect(result.success).toBe(false);
  });
});

describe("WizardDraftSchema", () => {
  const baseDraft = {
    version: 1 as const,
    file: { name: "contract.pdf", size: 2048, type: "application/pdf" },
    analysisResultId: "550e8400-e29b-41d4-a716-446655440001",
    entities: [],
    savedAt: new Date().toISOString(),
  };

  it("parses extractedText when present", () => {
    const result = WizardDraftSchema.safeParse({
      ...baseDraft,
      extractedText: "Texto extraído del documento",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.extractedText).toBe("Texto extraído del documento");
    }
  });

  it("tolerates legacy drafts without extractedText", () => {
    const result = WizardDraftSchema.safeParse(baseDraft);

    expect(result.success).toBe(true);
  });
});

describe("EntitySchema userCreated", () => {
  const validEntity = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    label: "COMPRADOR",
    value: "María González López",
    group: "PARTES" as const,
    confidence: "ALTA" as const,
    reviewed: false,
  };

  it("defaults userCreated to false", () => {
    const result = EntitySchema.safeParse(validEntity);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.userCreated).toBe(false);
    }
  });

  it("accepts userCreated: true explicitly", () => {
    const result = EntitySchema.safeParse({
      ...validEntity,
      userCreated: true,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.userCreated).toBe(true);
    }
  });

  it("rejects non-boolean userCreated", () => {
    const result = EntitySchema.safeParse({
      ...validEntity,
      userCreated: "yes",
    });
    expect(result.success).toBe(false);
  });
});

describe("MANUAL_ENTITY_LIMIT", () => {
  it("is set to 5", () => {
    expect(MANUAL_ENTITY_LIMIT).toBe(5);
  });
});

describe("ClassifySpanRequestSchema", () => {
  it("parses a valid request", () => {
    const result = ClassifySpanRequestSchema.safeParse({
      text: "Juan Pérez",
      sourceSpan: { start: 34, end: 44 },
      context: "...entre Juan Pérez y María López...",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty text", () => {
    const result = ClassifySpanRequestSchema.safeParse({
      text: "",
      sourceSpan: { start: 0, end: 5 },
      context: "context",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative start offset", () => {
    const result = ClassifySpanRequestSchema.safeParse({
      text: "hello",
      sourceSpan: { start: -1, end: 5 },
      context: "context",
    });
    expect(result.success).toBe(false);
  });

  it("rejects end offset less than 1", () => {
    const result = ClassifySpanRequestSchema.safeParse({
      text: "hello",
      sourceSpan: { start: 0, end: 0 },
      context: "context",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer offsets", () => {
    const result = ClassifySpanRequestSchema.safeParse({
      text: "hello",
      sourceSpan: { start: 0.5, end: 5 },
      context: "context",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing context", () => {
    const result = ClassifySpanRequestSchema.safeParse({
      text: "hello",
      sourceSpan: { start: 0, end: 5 },
    });
    expect(result.success).toBe(false);
  });
});

describe("ClassifySpanResponseSchema", () => {
  it("parses a valid response", () => {
    const result = ClassifySpanResponseSchema.safeParse({
      label: "COMPRADOR",
      group: "PARTES",
      value: "Juan Pérez",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty label", () => {
    const result = ClassifySpanResponseSchema.safeParse({
      label: "",
      group: "PARTES",
      value: "Juan Pérez",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid group", () => {
    const result = ClassifySpanResponseSchema.safeParse({
      label: "COMPRADOR",
      group: "INVALID",
      value: "Juan Pérez",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid groups", () => {
    for (const group of ["PARTES", "INMUEBLE", "FECHAS", "ANEXOS"]) {
      const result = ClassifySpanResponseSchema.safeParse({
        label: "FIELD",
        group,
        value: "some value",
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("UploadResponseSchema", () => {
  const validResponse = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    filename: "contract.pdf",
    mimeType: "application/pdf",
    sizeBytes: 2048,
    status: "completed",
    uploadedAt: new Date().toISOString(),
  };

  it("parses a valid upload response without cachedFromDocumentId", () => {
    const result = UploadResponseSchema.safeParse(validResponse);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cachedFromDocumentId).toBeUndefined();
    }
  });

  it("parses a valid upload response with cachedFromDocumentId", () => {
    const result = UploadResponseSchema.safeParse({
      ...validResponse,
      cachedFromDocumentId: "660e8400-e29b-41d4-a716-446655440001",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cachedFromDocumentId).toBe(
        "660e8400-e29b-41d4-a716-446655440001",
      );
    }
  });

  it("rejects when required fields are missing", () => {
    const { id, ...withoutId } = validResponse;
    const result = UploadResponseSchema.safeParse(withoutId);
    expect(result.success).toBe(false);
  });

  it("rejects invalid uuid for cachedFromDocumentId", () => {
    const result = UploadResponseSchema.safeParse({
      ...validResponse,
      cachedFromDocumentId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });
});
