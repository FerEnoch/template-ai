declare module "docx" {
  export interface IParagraphOptions {
    readonly text?: string;
    readonly heading?: string;
    readonly alignment?: string;
    readonly spacing?: { readonly after?: number };
  }

  export class Paragraph {
    constructor(options: IParagraphOptions);
  }

  export interface IDocumentOptions {
    readonly sections: ReadonlyArray<{
      readonly children: readonly Paragraph[];
    }>;
  }

  export class Document {
    constructor(options: IDocumentOptions);
  }

  export class Packer {
    static toBlob(document: Document): Promise<Blob>;
  }

  export enum AlignmentType {
    CENTER = "center",
    JUSTIFIED = "both",
    LEFT = "left",
    RIGHT = "right",
  }

  export enum HeadingLevel {
    HEADING_1 = "Heading1",
  }
}
