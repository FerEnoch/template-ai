import { describe, it, expect } from "vitest";
import { generatePdf } from "../pdf";
import { generateDocx } from "../docx";

describe("export pipelines", () => {
  it("generatePdf returns a Blob", () => {
    const blob = generatePdf({ text: "Paragraph one.\n\nParagraph two." });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/pdf");
  });

  it("generateDocx returns a Blob", async () => {
    const blob = await generateDocx({ text: "Paragraph one.\n\nParagraph two." });
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain("officedocument");
  });
});
