import { describe, it, expect } from "vitest";
import { inferFieldType } from "../inferFieldType";

describe("inferFieldType", () => {
  it.each([
    ["Fecha de inicio", "date"],
    ["fecha de nacimiento", "date"],
    ["Date of birth", "date"],
  ])("infers date from label %s", (label, expected) => {
    expect(inferFieldType(label)).toBe(expected);
  });

  it.each([
    ["Monto total", "number"],
    ["Precio del inmueble", "number"],
    ["Valor de la garantía", "number"],
    ["Número de contrato", "number"],
    ["Amount due", "number"],
  ])("infers number from label %s", (label, expected) => {
    expect(inferFieldType(label)).toBe(expected);
  });

  it.each([
    ["Acepta términos", "checkbox"],
    ["Conforme", "checkbox"],
    ["Acepta", "checkbox"],
  ])("infers checkbox from label %s", (label, expected) => {
    expect(inferFieldType(label)).toBe(expected);
  });

  it.each([
    ["Nombre del locador", "text"],
    ["Dirección completa", "text"],
    ["Descripción", "text"],
  ])("defaults to text for label %s", (label, expected) => {
    expect(inferFieldType(label)).toBe(expected);
  });
});
