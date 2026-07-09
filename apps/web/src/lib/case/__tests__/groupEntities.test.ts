import { describe, it, expect } from "vitest";
import { groupEntities, GROUP_ORDER } from "../groupEntities";
import type { Entity } from "@template-ai/contracts";

const entity = (id: string, group: Entity["group"]): Entity => ({
  id,
  label: id,
  value: "",
  group,
  confidence: "ALTA",
  reviewed: false,
  excluded: false,
  userCreated: false,
});

describe("groupEntities", () => {
  it("returns groups in fixed order even when input is shuffled", () => {
    const entities = [
      entity("e4", "ANEXOS"),
      entity("e1", "PARTES"),
      entity("e3", "FECHAS"),
      entity("e2", "INMUEBLE"),
    ];
    const result = groupEntities(entities);
    expect(result.map(([group]) => group)).toEqual(GROUP_ORDER);
  });

  it("groups entities under the correct section", () => {
    const entities = [
      entity("parte-a", "PARTES"),
      entity("parte-b", "PARTES"),
      entity("fecha-a", "FECHAS"),
    ];
    const result = groupEntities(entities);
    expect(result).toHaveLength(4);
    const partes = result.find(([group]) => group === "PARTES")?.[1];
    const fechas = result.find(([group]) => group === "FECHAS")?.[1];
    expect(partes).toHaveLength(2);
    expect(fechas).toHaveLength(1);
  });

  it("returns empty arrays for groups with no entities", () => {
    const entities = [entity("inmueble-a", "INMUEBLE")];
    const result = groupEntities(entities);
    const anexos = result.find(([group]) => group === "ANEXOS")?.[1];
    expect(anexos).toEqual([]);
  });

  it("handles an empty input", () => {
    const result = groupEntities([]);
    expect(result).toHaveLength(4);
    expect(result.every(([, items]) => items.length === 0)).toBe(true);
  });
});
