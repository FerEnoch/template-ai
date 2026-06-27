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

  if (title) {
    children.push(
      new docx.Paragraph({
        text: title,
        heading: docx.HeadingLevel.HEADING_1,
        alignment: docx.AlignmentType.CENTER,
      })
    );
  }

  for (const paragraph of paragraphs) {
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
