import { describe, it, expect } from "vitest";
import { buildFilename } from "../exporters";

describe("buildFilename", () => {
  it("generates a PDF filename from slug and case id", () => {
    expect(buildFilename("contrato-arrendamiento", "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "pdf")).toBe(
      "contrato-arrendamiento-a1b2c3d4.pdf"
    );
  });

  it("generates a DOCX filename from slug and case id", () => {
    expect(buildFilename("carta-documento", "12345678-1234-1234-1234-123456789abc", "docx")).toBe(
      "carta-documento-12345678.docx"
    );
  });

  it("lowercases the extension", () => {
    expect(buildFilename("contrato", "a1b2c3d4-1234-1234-1234-123456789abc", "PDF")).toBe(
      "contrato-a1b2c3d4.pdf"
    );
  });
});
