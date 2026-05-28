import { describe, it, expect } from "vitest";
import { EntitySchema } from "./schemas.js";

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