import * as docx from "docx";
import { splitParagraphs } from "./splitParagraphs";

export interface GenerateDocxOptions {
  readonly text: string;
  readonly title?: string;
}

export async function generateDocx({
  text,
  title,
}: GenerateDocxOptions): Promise<Blob> {
  const paragraphs = splitParagraphs(text);

  const children: docx.Paragraph[] = [];

  // First paragraph is the document title — render as HEADING_1.
  // The filename (title param) is metadata and NOT rendered in the document body.
  if (paragraphs.length > 0) {
    children.push(
      new docx.Paragraph({
        text: paragraphs[0],
        heading: docx.HeadingLevel.HEADING_1,
        alignment: docx.AlignmentType.CENTER,
      })
    );
  }

  const bodyParagraphs = paragraphs.length > 0 ? paragraphs.slice(1) : [];

  for (const paragraph of bodyParagraphs) {
    children.push(
      new docx.Paragraph({
        text: paragraph,
        alignment: docx.AlignmentType.JUSTIFIED,
        spacing: { after: 120 },
      })
    );
  }

  children.push(
    new docx.Paragraph({ text: "", spacing: { after: 400 } }),
    new docx.Paragraph({
      text: "Firma Locador: ___________________",
      alignment: docx.AlignmentType.LEFT,
    }),
    new docx.Paragraph({
      text: "Firma Locataria: ___________________",
      alignment: docx.AlignmentType.LEFT,
    })
  );

  const document = new docx.Document({
    sections: [{ children }],
  });

  return docx.Packer.toBlob(document);
}
