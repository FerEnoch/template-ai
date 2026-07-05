import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { PreviewPageContent } from "./page";
import { ApiError } from "@/lib/api/cases";
import type { CaseWithTemplate } from "@/lib/api/cases";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

const mockCase: CaseWithTemplate = {
  id: "case-1",
  userId: 0,
  templateId: "tmpl-1",
  status: "generado",
  formData: {},
  generatedText: "Texto generado",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  template: {
    id: "tmpl-1",
    name: "Plantilla de prueba",
    description: "",
    documentId: "00000000-0000-0000-0000-000000000000",
    entities: [],
    category: "general",
    createdAt: new Date().toISOString(),
    status: "published",
  },
};

const mockFetchCase = vi.fn();
const mockGenerateCase = vi.fn();

vi.mock("@/lib/api/cases", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/cases")>("@/lib/api/cases");
  return {
    ...actual,
    fetchCase: (...args: unknown[]) => mockFetchCase(...args),
    generateCase: (...args: unknown[]) => mockGenerateCase(...args),
  };
});

vi.mock("@/components/shell/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="app-shell">{children}</div>,
}));

vi.mock("@/components/preview/DocumentViewer", () => ({
  DocumentViewer: () => <div data-testid="document-viewer">DocumentViewer</div>,
}));

vi.mock("@/components/preview/VerificationChecklist", () => ({
  VerificationChecklist: () => <div data-testid="verification-checklist">VerificationChecklist</div>,
}));

vi.mock("@/components/preview/ExportPanel", () => ({
  ExportPanel: () => <div data-testid="export-panel">ExportPanel</div>,
}));

vi.mock("@/components/preview/ExportSpinner", () => ({
  ExportSpinner: () => <div data-testid="export-spinner">ExportSpinner</div>,
}));

describe("PreviewPageContent", () => {
  const mockRouter: AppRouterInstance = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };

  beforeEach(() => {
    mockFetchCase.mockResolvedValue(mockCase);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("calls generateCase a second time when clicking 'Reintentar' after a regenerate error", async () => {
    mockGenerateCase
      .mockRejectedValueOnce(new ApiError("Error al regenerar", 502, "NETWORK_ERROR"))
      .mockResolvedValueOnce(mockCase);

    render(<PreviewPageContent caseId="case-1" router={mockRouter} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /regenerar/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /regenerar/i }));

    await waitFor(() => {
      expect(mockGenerateCase).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText("Error al regenerar")).toBeInTheDocument();
    });

    const retryButton = screen.getByRole("button", { name: /reintentar/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(mockGenerateCase).toHaveBeenCalledTimes(2);
    });

    expect(mockGenerateCase).toHaveBeenNthCalledWith(
      1,
      "case-1",
      expect.any(AbortSignal),
    );
    expect(mockGenerateCase).toHaveBeenNthCalledWith(
      2,
      "case-1",
      expect.any(AbortSignal),
    );
  });

  it("renders a Spanish banner with the errorType when regeneration fails", async () => {
    mockGenerateCase.mockRejectedValue(
      new ApiError("No se pudo contactar al servicio de IA. Intentá nuevamente.", 502, "NETWORK_ERROR"),
    );

    render(<PreviewPageContent caseId="case-1" router={mockRouter} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /regenerar/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /regenerar/i }));

    await waitFor(() => {
      expect(
        screen.getByText("No se pudo contactar al servicio de IA. Intentá nuevamente."),
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Detalles")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Detalles"));
    expect(screen.getByText("Error de red")).toBeInTheDocument();
    expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
  });

  it("never calls window.location.reload", async () => {
    const reloadMock = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      value: { ...originalLocation, reload: reloadMock },
      configurable: true,
    });

    mockGenerateCase.mockRejectedValue(new ApiError("Error al regenerar", 502));

    render(<PreviewPageContent caseId="case-1" router={mockRouter} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /regenerar/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /regenerar/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));

    expect(reloadMock).not.toHaveBeenCalled();

    Object.defineProperty(window, "location", {
      value: originalLocation,
      configurable: true,
    });
  });
});
