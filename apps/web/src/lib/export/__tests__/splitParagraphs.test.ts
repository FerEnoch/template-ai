import { describe, it, expect } from "vitest";
import { splitParagraphs } from "../splitParagraphs";

describe("splitParagraphs", () => {
  it("splits generated text by double newlines", () => {
    const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
    expect(splitParagraphs(text)).toEqual([
      "First paragraph.",
      "Second paragraph.",
      "Third paragraph.",
    ]);
  });

  it("filters empty strings", () => {
    const text = "\n\n\n\nOnly content.\n\n  \n\n";
    expect(splitParagraphs(text)).toEqual(["Only content."]);
  });

  it("returns a single paragraph when there are no double newlines", () => {
    const text = "Single block of text.";
    expect(splitParagraphs(text)).toEqual(["Single block of text."]);
  });

  it("trims whitespace from each paragraph", () => {
    const text = "  Leading and trailing  \n\n\tAlso trimmed\t";
    expect(splitParagraphs(text)).toEqual([
      "Leading and trailing",
      "Also trimmed",
    ]);
  });
});
