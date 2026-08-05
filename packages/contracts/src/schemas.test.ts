import { describe, it, expect } from "vitest";
import {
  AnalysisResultSchema,
  EntitySchema,
  WizardDraftSchema,
  ClassifySpanRequestSchema,
  ClassifySpanResponseSchema,
  MANUAL_ENTITY_LIMIT,
  UpdateTemplateNameSchema,
  CaseSchema,
  TemplateSchema,
  SEED_GROUPS,
  GENERAL,
  OTROS,
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

describe("EntitySchema group widening", () => {
  const baseEntity = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    label: "COMPRADOR",
    value: "María González López",
    confidence: "ALTA" as const,
    reviewed: false,
  };

  it("accepts seed group PARTES", () => {
    const result = EntitySchema.safeParse({ ...baseEntity, group: "PARTES" });
    expect(result.success).toBe(true);
  });

  it("accepts GENERAL group", () => {
    const result = EntitySchema.safeParse({ ...baseEntity, group: "GENERAL" });
    expect(result.success).toBe(true);
  });

  it("accepts OTROS group", () => {
    const result = EntitySchema.safeParse({ ...baseEntity, group: "OTROS" });
    expect(result.success).toBe(true);
  });

  it("accepts dynamic group", () => {
    const result = EntitySchema.safeParse({ ...baseEntity, group: "JORNADA" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.group).toBe("JORNADA");
    }
  });

  it("rejects empty group", () => {
    const result = EntitySchema.safeParse({ ...baseEntity, group: "" });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only group", () => {
    const result = EntitySchema.safeParse({ ...baseEntity, group: "   " });
    expect(result.success).toBe(false);
  });
});

describe("EntitySchema reviewedAt", () => {
  const baseEntity = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    label: "COMPRADOR",
    value: "María González López",
    group: "PARTES" as const,
    confidence: "ALTA" as const,
    reviewed: true,
  };

  it("accepts reviewedAt ISO datetime", () => {
    const result = EntitySchema.safeParse({
      ...baseEntity,
      reviewedAt: "2026-01-15T10:30:00Z",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reviewedAt).toBe("2026-01-15T10:30:00Z");
    }
  });

  it("accepts reviewedAt as null", () => {
    const result = EntitySchema.safeParse({ ...baseEntity, reviewedAt: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reviewedAt).toBeNull();
    }
  });

  it("accepts entity without reviewedAt for backward compat", () => {
    const result = EntitySchema.safeParse(baseEntity);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reviewedAt).toBeUndefined();
    }
  });
});

describe("TemplateSchema suggestedGroupsStatus", () => {
  const baseTemplate = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Contrato",
    description: "",
    documentId: "660e8400-e29b-41d4-a716-446655440001",
    entities: [],
    category: "legal",
    createdAt: "2025-01-01T00:00:00.000Z",
    status: "draft" as const,
  };

  it("accepts suggestedGroupsStatus with pending group", () => {
    const result = TemplateSchema.safeParse({
      ...baseTemplate,
      suggestedGroupsStatus: { JORNADA: "pending" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suggestedGroupsStatus).toEqual({ JORNADA: "pending" });
    }
  });

  it("accepts suggestedGroupsStatus with approved and rejected groups", () => {
    const result = TemplateSchema.safeParse({
      ...baseTemplate,
      suggestedGroupsStatus: { JORNADA: "approved", FALTAS: "rejected" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts template without suggestedGroupsStatus for backward compat", () => {
    const result = TemplateSchema.safeParse(baseTemplate);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.suggestedGroupsStatus).toBeUndefined();
    }
  });

  it("rejects invalid suggestedGroupsStatus value", () => {
    const result = TemplateSchema.safeParse({
      ...baseTemplate,
      suggestedGroupsStatus: { JORNADA: "unknown" },
    });
    expect(result.success).toBe(false);
  });
});

describe("SEED_GROUPS constants", () => {
  it("exports seed groups including GENERAL and OTROS", () => {
    expect(SEED_GROUPS).toContain("PARTES");
    expect(SEED_GROUPS).toContain("INMUEBLE");
    expect(SEED_GROUPS).toContain("FECHAS");
    expect(SEED_GROUPS).toContain("ANEXOS");
    expect(SEED_GROUPS).toContain("GENERAL");
    expect(SEED_GROUPS).toContain("OTROS");
  });

  it("exports GENERAL and OTROS constants", () => {
    expect(GENERAL).toBe("GENERAL");
    expect(OTROS).toBe("OTROS");
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

describe("UpdateTemplateNameSchema", () => {
  it("parses a valid name", () => {
    const result = UpdateTemplateNameSchema.safeParse({ name: "Contrato Alquiler" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Contrato Alquiler");
    }
  });

  it("rejects an empty name", () => {
    const result = UpdateTemplateNameSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a whitespace-only name", () => {
    const result = UpdateTemplateNameSchema.safeParse({ name: "   " });
    expect(result.success).toBe(false);
  });

  it("rejects a name over 200 characters", () => {
    const result = UpdateTemplateNameSchema.safeParse({ name: "a".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    const result = UpdateTemplateNameSchema.safeParse({ name: "  Contrato Alquiler  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Contrato Alquiler");
    }
  });
});

describe("CaseSchema name field", () => {
  const baseCase = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    userId: 1,
    templateId: "660e8400-e29b-41d4-a716-446655440001",
    status: "borrador" as const,
    formData: { ent_1: "Juan Pérez" },
    generatedText: null,
    effectiveTitle: "Test Case",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  };

  it("accepts a custom name", () => {
    const result = CaseSchema.safeParse({
      ...baseCase,
      name: "Contrato Pérez",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Contrato Pérez");
    }
  });

  it("accepts name as null", () => {
    const result = CaseSchema.safeParse({
      ...baseCase,
      name: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBeNull();
    }
  });

  it("accepts case without name for backward compatibility", () => {
    const result = CaseSchema.safeParse(baseCase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBeUndefined();
    }
  });

  it("rejects a name over 200 characters", () => {
    const result = CaseSchema.safeParse({
      ...baseCase,
      name: "a".repeat(201),
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

  it("rejects empty group", () => {
    const result = ClassifySpanResponseSchema.safeParse({
      label: "COMPRADOR",
      group: "",
      value: "Juan Pérez",
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only group", () => {
    const result = ClassifySpanResponseSchema.safeParse({
      label: "COMPRADOR",
      group: "   ",
      value: "Juan Pérez",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all seed groups", () => {
    for (const group of ["PARTES", "INMUEBLE", "FECHAS", "ANEXOS"]) {
      const result = ClassifySpanResponseSchema.safeParse({
        label: "FIELD",
        group,
        value: "some value",
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts GENERAL group", () => {
    const result = ClassifySpanResponseSchema.safeParse({
      label: "Lugar",
      group: "GENERAL",
      value: "Av. Central 123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts dynamic group", () => {
    const result = ClassifySpanResponseSchema.safeParse({
      label: "Jornada",
      group: "JORNADA",
      value: "8 horas",
    });
    expect(result.success).toBe(true);
  });
});
