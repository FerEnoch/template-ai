import { describe, expect, it, vi, beforeEach } from "vitest";
import { FewShotProvider } from "./few-shot-provider.js";
import type { EntityRecord } from "../infrastructure/postgres/repositories/entities.repository.js";

function makeEntity(overrides: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    analysisResultId: "660e8400-e29b-41d4-a716-446655440001",
    documentId: "770e8400-e29b-41d4-a716-446655440002",
    label: "Parte Actora",
    value: "Juan Pérez",
    group: "PARTES",
    confidence: "ALTA",
    sourceSpan: null,
    reviewed: true,
    reviewedAt: new Date("2026-01-15T10:30:00Z"),
    excluded: false,
    userCreated: false,
    ...overrides,
  };
}

describe("FewShotProvider", () => {
  let provider: FewShotProvider;
  let findReviewedForFewShot: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    findReviewedForFewShot = vi.fn().mockResolvedValue([]);
    const mockRepo = {
      findReviewedForFewShot,
    } as unknown as {
      findReviewedForFewShot: (userId: number) => Promise<EntityRecord[]>;
    };
    provider = new FewShotProvider(mockRepo, { maxTokens: 8192 });
  });

  it("returns formatted examples when reviewed entities exist", async () => {
    findReviewedForFewShot.mockResolvedValue([
      makeEntity({
        label: "Arrendatario",
        value: "Juan Pérez",
        group: "PARTES",
        confidence: "ALTA",
      }),
    ]);

    const result = await provider.getExamples(42);

    expect(result).toContain("Arrendatario");
    expect(result).toContain("Juan Pérez");
    expect(result).toContain("PARTES");
    expect(result).toContain("ALTA");
    expect(findReviewedForFewShot).toHaveBeenCalledWith(42);
  });

  it("returns empty string when no reviewed entities exist", async () => {
    findReviewedForFewShot.mockResolvedValue([]);

    const result = await provider.getExamples(42);

    expect(result).toBe("");
  });

  it("formats multiple entities correctly", async () => {
    findReviewedForFewShot.mockResolvedValue([
      makeEntity({
        label: "Arrendatario",
        value: "Juan Pérez",
        group: "PARTES",
        confidence: "ALTA",
        reviewedAt: new Date("2026-01-15T12:00:00Z"),
      }),
      makeEntity({
        label: "Inmueble",
        value: "Av. Reforma 123",
        group: "INMUEBLE",
        confidence: "MEDIA",
        reviewedAt: new Date("2026-01-15T11:00:00Z"),
      }),
      makeEntity({
        label: "Fecha Firma",
        value: "2026-01-10",
        group: "FECHAS",
        confidence: "ALTA",
        reviewedAt: new Date("2026-01-15T10:00:00Z"),
      }),
    ]);

    const result = await provider.getExamples(42);

    expect(result).toContain("Arrendatario");
    expect(result).toContain("Inmueble");
    expect(result).toContain("Fecha Firma");
  });

  it("truncates to one example when the formatted block exceeds 25% of max tokens", async () => {
    const longValue = "x".repeat(10_000);
    findReviewedForFewShot.mockResolvedValue([
      makeEntity({ value: longValue, reviewedAt: new Date("2026-01-15T12:00:00Z") }),
      makeEntity({ value: longValue, reviewedAt: new Date("2026-01-15T11:00:00Z") }),
      makeEntity({ value: longValue, reviewedAt: new Date("2026-01-15T10:00:00Z") }),
    ]);

    const warnSpy = vi.spyOn(provider["logger"], "warn").mockImplementation(() => undefined);
    provider = new FewShotProvider(
      { findReviewedForFewShot } as unknown as {
        findReviewedForFewShot: (userId: number) => Promise<EntityRecord[]>;
      },
      { maxTokens: 100 },
    );
    // Re-attach spy to new instance logger.
    vi.spyOn(provider["logger"], "warn").mockImplementation(() => undefined);

    const result = await provider.getExamples(42);

    // One example should still exceed the tiny budget, so the provider degrades to empty.
    expect(result.length).toBeLessThan(500);
    expect(provider["logger"].warn).toHaveBeenCalledWith(
      expect.stringContaining("few-shot"),
    );
    warnSpy.mockRestore();
  });

  it("returns empty string and logs a warning when the repository query fails", async () => {
    findReviewedForFewShot.mockRejectedValue(new Error("DB down"));

    const warnSpy = vi.spyOn(provider["logger"], "warn").mockImplementation(() => undefined);

    const result = await provider.getExamples(42);

    expect(result).toBe("");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("DB down"),
    );
    warnSpy.mockRestore();
  });
});
