import { describe, expect, it } from "vitest";
import { SmartFileValidator } from "./smart-file.validator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pdfBuffer(): Buffer {
  // Starts with %PDF
  return Buffer.from("%PDF-1.4 fake content...");
}

function docxBuffer(): Buffer {
  // Starts with PK\x03\x04 (ZIP container)
  const buf = Buffer.alloc(100);
  buf[0] = 0x50;
  buf[1] = 0x4b;
  buf[2] = 0x03;
  buf[3] = 0x04;
  buf.write("fake.docx content...", 4);
  return buf;
}

function jpegBuffer(): Buffer {
  // Starts with \xFF\xD8\xFF
  const buf = Buffer.alloc(100);
  buf[0] = 0xff;
  buf[1] = 0xd8;
  buf[2] = 0xff;
  buf.write("fake jpeg content...", 3);
  return buf;
}

function randomBuffer(): Buffer {
  return Buffer.from("this is not a valid file of any type");
}

function makeFile(overrides: Partial<Express.Multer.File>): Express.Multer.File {
  return {
    fieldname: "file",
    originalname: "test.pdf",
    encoding: "7bit",
    mimetype: "application/pdf",
    destination: "",
    filename: "test.pdf",
    path: "",
    size: 100,
    stream: process.stdout as never,
    buffer: Buffer.alloc(0),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SmartFileValidator", () => {
  const validator = new SmartFileValidator();

  describe("buildMessage", () => {
    it('returns a message listing accepted formats', () => {
      const msg = validator.buildMessage();
      expect(msg).toContain("PDF");
      expect(msg).toContain("DOCX");
      expect(msg).toContain("JPEG");
    });
  });

  describe("isValid with buffer (memoryStorage)", () => {
    it("accepts a PDF with correct MIME and magic bytes", () => {
      const file = makeFile({ buffer: pdfBuffer() });
      expect(validator.isValid(file)).toBe(true);
    });

    it("accepts a PDF with wrong MIME but correct magic bytes", () => {
      const file = makeFile({ mimetype: "application/octet-stream", buffer: pdfBuffer() });
      expect(validator.isValid(file)).toBe(true);
    });

    it("accepts a DOCX with correct MIME and magic bytes", () => {
      const file = makeFile({
        mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer: docxBuffer(),
      });
      expect(validator.isValid(file)).toBe(true);
    });

    it("accepts a JPEG with correct MIME and magic bytes", () => {
      const file = makeFile({ mimetype: "image/jpeg", buffer: jpegBuffer() });
      expect(validator.isValid(file)).toBe(true);
    });

    it("rejects a file that claims PDF but has random bytes", () => {
      const file = makeFile({ buffer: randomBuffer() });
      expect(validator.isValid(file)).toBe(false);
    });

    it("rejects a file that claims JPEG but is actually a text file", () => {
      const file = makeFile({ mimetype: "image/jpeg", buffer: randomBuffer() });
      expect(validator.isValid(file)).toBe(false);
    });

    it("rejects a totally unknown file type", () => {
      const file = makeFile({ mimetype: "text/plain", buffer: randomBuffer() });
      expect(validator.isValid(file)).toBe(false);
    });
  });

  describe("isValid with path (diskStorage)", () => {
    it("accepts a real PDF file from disk", () => {
      const tmpPath = "/tmp/__test_valid_pdf.pdf";
      require("node:fs").writeFileSync(tmpPath, pdfBuffer());
      const file = makeFile({ path: tmpPath, buffer: Buffer.alloc(0) });
      expect(validator.isValid(file)).toBe(true);
      require("node:fs").unlinkSync(tmpPath);
    });

    it("accepts a real PDF with wrong MIME from disk", () => {
      const tmpPath = "/tmp/__test_valid_pdf_wrong_mime.pdf";
      require("node:fs").writeFileSync(tmpPath, pdfBuffer());
      const file = makeFile({ mimetype: "application/octet-stream", path: tmpPath, buffer: Buffer.alloc(0) });
      expect(validator.isValid(file)).toBe(true);
      require("node:fs").unlinkSync(tmpPath);
    });

    it("rejects a fake PDF from disk (wrong magic bytes)", () => {
      const tmpPath = "/tmp/__test_fake_pdf.pdf";
      require("node:fs").writeFileSync(tmpPath, randomBuffer());
      const file = makeFile({ path: tmpPath, buffer: Buffer.alloc(0) });
      expect(validator.isValid(file)).toBe(false);
      require("node:fs").unlinkSync(tmpPath);
    });

    it("rejects when file path does not exist", () => {
      const file = makeFile({ path: "/tmp/__nonexistent_file.pdf", buffer: Buffer.alloc(0) });
      expect(validator.isValid(file)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("rejects null/undefined file", () => {
      expect(validator.isValid(null as never)).toBe(false);
      expect(validator.isValid(undefined as never)).toBe(false);
    });

    it("rejects file with empty buffer and no path (no data to validate)", () => {
      const file = makeFile({ buffer: Buffer.alloc(0), path: "" });
      expect(validator.isValid(file)).toBe(false);
    });

    it("rejects file with empty buffer and non-empty path pointing to nonexistent file", () => {
      const file = makeFile({ path: "/tmp/__nonexistent_also.pdf", buffer: Buffer.alloc(0) });
      expect(validator.isValid(file)).toBe(false);
    });
  });
});
