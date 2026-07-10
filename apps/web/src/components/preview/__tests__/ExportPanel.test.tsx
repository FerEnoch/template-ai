import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ExportPanel } from "../ExportPanel";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockGeneratePdf = vi.fn(() => new Blob(["pdf"], { type: "application/pdf" }));
const mockGenerateDocx = vi.fn(() =>
  Promise.resolve(new Blob(["docx"], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }))
);
const mockUpdateCase = vi.fn(() => Promise.resolve({ id: "case-1", status: "exportado" }));
const mockTriggerDownload = vi.fn();

vi.mock("@/lib/export/pdf", () => ({
  generatePdf: (...args: unknown[]) => mockGeneratePdf(...args),
}));

vi.mock("@/lib/export/docx", () => ({
  generateDocx: (...args: unknown[]) => mockGenerateDocx(...args),
}));

vi.mock("@/lib/api/cases", () => ({
  updateCase: (...args: unknown[]) => mockUpdateCase(...args),
}));

vi.mock("@/lib/export/exporters", async () => {
  const actual = await vi.importActual<typeof import("@/lib/export/exporters")>("@/lib/export/exporters");
  return {
    ...actual,
    triggerDownload: (...args: unknown[]) => mockTriggerDownload(...args),
  };
});

describe("ExportPanel", () => {
  const CASE_ID = "case-123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:url"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("uses displayTitle for the PDF heading and filenameSlug for the PDF filename", async () => {
    render(
      <ExportPanel
        caseId={CASE_ID}
        displayTitle="Título Exportado"
        filenameSlug="titulo-exportado"
        generatedText="Texto generado"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));

    await waitFor(() => {
      expect(mockGeneratePdf).toHaveBeenCalledWith({
        text: "Texto generado",
        title: "Título Exportado",
      });
    });

    await waitFor(() => {
      expect(mockTriggerDownload).toHaveBeenCalledWith(
        expect.any(Blob),
        `titulo-exportado-${CASE_ID.slice(0, 8)}.pdf`
      );
    });

    expect(mockUpdateCase).toHaveBeenCalledWith(CASE_ID, { status: "exportado" });
  });

  it("uses displayTitle for the DOCX heading and filenameSlug for the DOCX filename", async () => {
    render(
      <ExportPanel
        caseId={CASE_ID}
        displayTitle="Título Exportado"
        filenameSlug="titulo-exportado"
        generatedText="Texto generado"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /descargar docx/i }));

    await waitFor(() => {
      expect(mockGenerateDocx).toHaveBeenCalledWith({
        text: "Texto generado",
        title: "Título Exportado",
      });
    });

    await waitFor(() => {
      expect(mockTriggerDownload).toHaveBeenCalledWith(
        expect.any(Blob),
        `titulo-exportado-${CASE_ID.slice(0, 8)}.docx`
      );
    });
  });

  it("preserves displayTitle casing while keeping the filename slugified", async () => {
    render(
      <ExportPanel
        caseId={CASE_ID}
        displayTitle="Compraventa de Inmueble"
        filenameSlug="compraventa-de-inmueble"
        generatedText="Texto generado"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /descargar pdf/i }));

    await waitFor(() => {
      expect(mockGeneratePdf).toHaveBeenCalledWith({
        text: "Texto generado",
        title: "Compraventa de Inmueble",
      });
    });

    await waitFor(() => {
      expect(mockTriggerDownload).toHaveBeenCalledWith(
        expect.any(Blob),
        `compraventa-de-inmueble-${CASE_ID.slice(0, 8)}.pdf`
      );
    });
  });
});
