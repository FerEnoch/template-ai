import { jsPDF } from "jspdf";
import { splitParagraphs } from "./splitParagraphs";

export interface GeneratePdfOptions {
  readonly text: string;
  readonly title?: string;
}

export function generatePdf({ text, title }: GeneratePdfOptions): Blob {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const marginX = 20;
  const maxWidth = pageWidth - marginX * 2;
  let cursorY = 20;

  doc.setFont("times", "normal");
  doc.setFontSize(12);

  if (title) {
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text(title, pageWidth / 2, cursorY, { align: "center" });
    cursorY += 12;
    doc.setFont("times", "normal");
    doc.setFontSize(12);
  }

  const paragraphs = splitParagraphs(text);

  for (const paragraph of paragraphs) {
    const lines = doc.splitTextToSize(paragraph, maxWidth);
    const blockHeight = lines.length * 6;

    if (cursorY + blockHeight > 270) {
      doc.addPage();
      cursorY = 20;
    }

    doc.text(lines, marginX, cursorY, {
      align: "justify",
      maxWidth,
    });
    cursorY += blockHeight + 4;
  }

  // Signature zones
  if (cursorY + 40 > 270) {
    doc.addPage();
    cursorY = 20;
  }

  cursorY += 20;
  doc.setFont("times", "italic");
  doc.setFontSize(11);
  doc.text("Firma Locador: ___________________", marginX, cursorY);
  doc.text(
    "Firma Locataria: ___________________",
    pageWidth - marginX,
    cursorY,
    { align: "right" }
  );

  return doc.output("blob");
}
