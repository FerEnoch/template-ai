import { FileValidator } from "@nestjs/common";
import { openSync, readSync, closeSync } from "node:fs";

// ---------------------------------------------------------------------------
// Magic byte signatures for supported file types
// ---------------------------------------------------------------------------
// The check function receives a buffer with the FIRST bytes of the file.
// We keep this as a simple array so extending types is trivial.
// ---------------------------------------------------------------------------
const MAGIC_DB: { mime: string; check: (header: Buffer) => boolean }[] = [
  {
    mime: "application/pdf",
    check: (header) =>
      header.length >= 4 &&
      header[0] === 0x25 &&
      header[1] === 0x50 &&
      header[2] === 0x44 &&
      header[3] === 0x46, // %PDF
  },
  {
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    check: (header) =>
      header.length >= 4 &&
      header[0] === 0x50 &&
      header[1] === 0x4b &&
      header[2] === 0x03 &&
      header[3] === 0x04, // PK\x03\x04 (ZIP container)
  },
  {
    mime: "image/jpeg",
    check: (header) =>
      header.length >= 3 &&
      header[0] === 0xff &&
      header[1] === 0xd8 &&
      header[2] === 0xff, // \xFF\xD8\xFF
  },
  {
    mime: "text/plain",
    check: (header) => {
      // Text files have no magic bytes. Validate that content is valid
      // UTF-8 text — reject binary garbage masquerading as text/plain.
      if (header.length === 0) return false;
      // Null bytes strongly indicate binary content
      if (header.includes(0x00)) return false;
      try {
        new TextDecoder("utf-8", { fatal: true }).decode(header);
        return true;
      } catch {
        return false;
      }
    },
  },
];

const ALLOWED_MIMES: string[] = MAGIC_DB.map((e) => e.mime);

const MAGIC_READ_SIZE = 8; // we only need 4 max, read 8 for safety

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

export class SmartFileValidator extends FileValidator {
  constructor() {
    super({});
  }

  buildMessage(): string {
    return "Unsupported file type. Accepted formats: PDF, DOCX, JPEG, TXT/MD";
  }

  buildErrorMessage(_file: Express.Multer.File): string {
    return "File could not be processed. It may be corrupted or unreadable.";
  }

  isValid(file: Express.Multer.File): boolean {
    if (!file) return false;

    // Priority 1: buffer available (memoryStorage) — easiest path
    if (file.buffer && file.buffer.length > 0) {
      return this.validateBuffer(file.buffer, file.mimetype);
    }

    // Priority 2: file on disk (diskStorage) — read first bytes
    if (file.path) {
      return this.validateFileOnDisk(file.path, file.mimetype);
    }

    // No data to validate — reject. Multer always provides at least one.
    return false;
  }

  // -- Private -----------------------------------------------------------

  private validateBuffer(buffer: Buffer, mimeType: string): boolean {
    return this.magicMatch(mimeType, buffer);
  }

  private validateFileOnDisk(filePath: string, mimeType: string): boolean {
    let fd: number | undefined;
    try {
      fd = openSync(filePath, "r");
      const buf = Buffer.alloc(MAGIC_READ_SIZE);
      const bytesRead = readSync(fd, buf, 0, MAGIC_READ_SIZE, 0);

      if (bytesRead === 0) return false;

      return this.magicMatch(mimeType, buf.subarray(0, bytesRead));
    } catch {
      return false;
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
  }

  private magicMatch(mimeType: string, header: Buffer): boolean {
    const entry = MAGIC_DB.find((e) => e.mime === mimeType);

    if (entry) {
      // Known MIME — magic bytes MUST match (security guard)
      return entry.check(header);
    }

    // Unknown/Wrong MIME from request — try ALL magic checks as lenient fallback
    // This covers dev scenarios where the frontend sends application/octet-stream
    // or a proxy mangles the Content-Type
    return MAGIC_DB.some((e) => e.check(header));
  }
}
