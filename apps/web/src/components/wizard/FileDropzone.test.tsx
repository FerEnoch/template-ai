import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { FileDropzone } from "./FileDropzone";

/**
 * Helper: create a File-like object for jsdom testing.
 * jsdom doesn't fully implement the File constructor's `type` detection
 * from extension, so we explicitly set `type`.
 */
function createFile(
  name: string,
  type: string,
  size: number = 1024,
): File {
  const file = new File(["content"], name, { type });
  // Override type/size to ensure deterministic test behavior
  Object.defineProperty(file, "type", {
    value: type,
    writable: false,
    configurable: true,
  });
  Object.defineProperty(file, "size", {
    value: size,
    writable: false,
    configurable: true,
  });
  return file;
}

function createFileWithEmptyType(name: string, size: number = 1024): File {
  return createFile(name, "", size);
}

/**
 * Helper: simulate a user uploading a file via the hidden file input.
 * Finds the input by test id and dispatches a change event.
 */
function uploadFile(file: File) {
  const input = screen.getByTestId("file-input") as HTMLInputElement;
  // jsdom needs a FileList-like object on input.files
  Object.defineProperty(input, "files", {
    value: [file],
    writable: false,
  });
  fireEvent.change(input);
}

afterEach(() => {
  cleanup();
});

describe("FileDropzone", () => {
  // ── text/plain acceptance ──

  describe("text/plain acceptance", () => {
    it("accepts .txt files with text/plain MIME type", () => {
      const onAccepted = vi.fn();
      const onRemoved = vi.fn();

      render(
        <FileDropzone onFileAccepted={onAccepted} onFileRemoved={onRemoved} />,
      );

      uploadFile(createFile("documento.txt", "text/plain"));

      expect(onAccepted).toHaveBeenCalledTimes(1);
      expect(onAccepted).toHaveBeenCalledWith(
        { name: "documento.txt", size: 1024, type: "text/plain" },
        expect.any(File),
      );
      expect(
        screen.queryByText(/formato no soportado/i),
      ).not.toBeInTheDocument();
    });

    it("accepts .md files with empty MIME type via extension fallback", () => {
      const onAccepted = vi.fn();
      const onRemoved = vi.fn();

      render(
        <FileDropzone onFileAccepted={onAccepted} onFileRemoved={onRemoved} />,
      );

      uploadFile(createFileWithEmptyType("README.md"));

      expect(onAccepted).toHaveBeenCalledTimes(1);
      expect(onAccepted).toHaveBeenCalledWith(
        { name: "README.md", size: 1024, type: "text/plain" },
        expect.any(File),
      );
    });

    it("accepts .txt files with empty MIME type via extension fallback", () => {
      const onAccepted = vi.fn();
      const onRemoved = vi.fn();

      render(
        <FileDropzone onFileAccepted={onAccepted} onFileRemoved={onRemoved} />,
      );

      uploadFile(createFileWithEmptyType("notas.txt"));

      expect(onAccepted).toHaveBeenCalledTimes(1);
    });

    it("normalizes .md extension to text/plain type in callback", () => {
      const onAccepted = vi.fn();
      const onRemoved = vi.fn();

      render(
        <FileDropzone onFileAccepted={onAccepted} onFileRemoved={onRemoved} />,
      );

      uploadFile(createFileWithEmptyType("LEGAL.md"));

      expect(onAccepted).toHaveBeenCalledWith(
        expect.objectContaining({ type: "text/plain" }),
        expect.any(File),
      );
    });
  });

  // ── rejection stays intact ──

  describe("rejection of unsupported types", () => {
    it("rejects .exe files even with empty MIME type", () => {
      const onAccepted = vi.fn();
      const onRemoved = vi.fn();

      render(
        <FileDropzone onFileAccepted={onAccepted} onFileRemoved={onRemoved} />,
      );

      uploadFile(createFileWithEmptyType("malware.exe"));

      expect(onAccepted).not.toHaveBeenCalled();
      expect(
        screen.getByText(/formato no soportado/i),
      ).toBeInTheDocument();
    });

    it("rejects unknown extensions with empty MIME type", () => {
      const onAccepted = vi.fn();
      const onRemoved = vi.fn();

      render(
        <FileDropzone onFileAccepted={onAccepted} onFileRemoved={onRemoved} />,
      );

      uploadFile(createFileWithEmptyType("datos.xyz"));

      expect(onAccepted).not.toHaveBeenCalled();
      expect(
        screen.getByText(/formato no soportado/i),
      ).toBeInTheDocument();
    });

    it("rejects .csv files (not in accepted list)", () => {
      const onAccepted = vi.fn();
      const onRemoved = vi.fn();

      render(
        <FileDropzone onFileAccepted={onAccepted} onFileRemoved={onRemoved} />,
      );

      uploadFile(createFile("datos.csv", "text/csv"));

      expect(onAccepted).not.toHaveBeenCalled();
      expect(
        screen.getByText(/formato no soportado/i),
      ).toBeInTheDocument();
    });
  });

  // ── error message ──

  describe("error message", () => {
    it("mentions text formats in unsupported format error", () => {
      const onAccepted = vi.fn();
      const onRemoved = vi.fn();

      render(
        <FileDropzone onFileAccepted={onAccepted} onFileRemoved={onRemoved} />,
      );

      uploadFile(createFile("virus.exe", "application/x-msdownload"));

      const error = screen.getByText(/formato no soportado/i);
      expect(error).toBeInTheDocument();
      expect(error.textContent).toMatch(/txt|md|texto/i);
    });
  });

  // ── size validation still works for text files ──

  describe("size validation for text files", () => {
    it("rejects oversized text file", () => {
      const onAccepted = vi.fn();
      const onRemoved = vi.fn();

      render(
        <FileDropzone onFileAccepted={onAccepted} onFileRemoved={onRemoved} />,
      );

      const OVERSIZED = 26 * 1024 * 1024; // 26MB > 25MB limit
      uploadFile(createFile("grande.txt", "text/plain", OVERSIZED));

      expect(onAccepted).not.toHaveBeenCalled();
      expect(screen.getByText(/supera el límite/i)).toBeInTheDocument();
    });
  });

  // ── UI badges ──

  describe("format badges", () => {
    it("shows TXT, MD badge", () => {
      const onAccepted = vi.fn();
      const onRemoved = vi.fn();

      render(
        <FileDropzone onFileAccepted={onAccepted} onFileRemoved={onRemoved} />,
      );

      expect(screen.getByText(/txt.*md/i)).toBeInTheDocument();
    });
  });

  // ── uploaded card shows proper info for text files ──

  describe("uploaded file card", () => {
    it("shows file name in uploaded card for text file", () => {
      const onAccepted = vi.fn();
      const onRemoved = vi.fn();

      render(
        <FileDropzone
          onFileAccepted={onAccepted}
          onFileRemoved={onRemoved}
          acceptedFile={{ name: "notas.txt", size: 1024, type: "text/plain" }}
        />,
      );

      expect(screen.getByText("notas.txt")).toBeInTheDocument();
    });
  });
});
