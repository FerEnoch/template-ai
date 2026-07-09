export type FieldType = "text" | "date" | "number" | "checkbox";

export function inferFieldType(label: string): FieldType {
  const normalized = label.toLowerCase();

  if (/fecha|date/.test(normalized)) {
    return "date";
  }

  if (/monto|valor|precio|amount|price|número|numero/.test(normalized)) {
    return "number";
  }

  if (/acepta|conforme|accept/.test(normalized)) {
    return "checkbox";
  }

  return "text";
}
