import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import { PreviewPageContent } from "@/components/preview/PreviewPageContent";
import type { CaseWithTemplateResponse } from "@/lib/api/cases";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

const mockFetchCase = vi.fn();
const mockUpdateCase = vi.fn();
const mockGenerateCase = vi.fn();

vi.mock("@/lib/api/cases", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/cases")>("@/lib/api/cases");
  return {
    ...actual,
    fetchCase: (...args: unknown[]) => mockFetchCase(...args),
    updateCase: (...args: unknown[]) => mockUpdateCase(...args),
    generateCase: (...args: unknown[]) => mockGenerateCase(...args),
  };
});

vi.mock("@/components/shell/app-shell", () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="app-shell">{children}</div>
  ),
}));

vi.mock("@/components/preview/VerificationChecklist", () => ({
  VerificationChecklist: () => <div data-testid="verification-checklist" />,
}));

vi.mock("@/components/preview/ExportSpinner", () => ({
  ExportSpinner: () => <div data-testid="export-spinner" />,
}));

const capturedExportPanelProps: Array<{
  displayTitle?: string;
  filenameSlug?: string;
}> = [];

vi.mock("@/components/preview/ExportPanel", () => ({
  ExportPanel: (props: {
    caseId: string;
    displayTitle: string;
    filenameSlug: string;
    generatedText: string;
  }) => {
    capturedExportPanelProps.push(props);
    return (
      <div data-testid="export-panel">
        <span data-testid="export-display-title">{props.displayTitle}</span>
        <span data-testid="export-filename-slug">{props.filenameSlug}</span>
      </div>
    );
  },
}));

vi.mock("@/components/preview/DocumentViewer", () => ({
  DocumentViewer: ({
    onRenameContentTitle,
  }: {
    onRenameContentTitle?: (value: string, signal?: AbortSignal) => Promise<void>;
  }) => (
    <div data-testid="document-viewer">
      <button
        type="button"
        data-testid="trigger-content-title-rename"
        onClick={() => void onRenameContentTitle?.("Nuevo título")}
      >
        Renombrar título del documento
      </button>
    </div>
  ),
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

  const mockCase: CaseWithTemplateResponse = {
    id: "case-1",
    userId: 0,
    templateId: "tmpl-1",
    status: "generado",
    name: "Caso renombrado",
    contentTitle: null,
    effectiveTitle: "Caso renombrado",
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

  beforeEach(() => {
    mockFetchCase.mockResolvedValue(mockCase);
    mockUpdateCase.mockResolvedValue({ ...mockCase });
    capturedExportPanelProps.length = 0;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("passes displayTitle={name ?? template.name} and filenameSlug={slugify(...)} to ExportPanel", async () => {
    render(<PreviewPageContent caseId="case-1" router={mockRouter} />);

    await waitFor(() => {
      expect(screen.getByTestId("export-panel")).toBeInTheDocument();
    });

    const props = capturedExportPanelProps[capturedExportPanelProps.length - 1];

    expect(props.displayTitle).toBe("Caso renombrado");
    expect(props.filenameSlug).toBe("caso-renombrado");
    expect(screen.getByTestId("export-display-title")).toHaveTextContent("Caso renombrado");
    expect(screen.getByTestId("export-filename-slug")).toHaveTextContent("caso-renombrado");
  });

  it("calls updateCase with { contentTitle } and uses effectiveTitle as displayTitle", async () => {
    mockUpdateCase.mockResolvedValue({
      ...mockCase,
      contentTitle: "Nuevo título",
      effectiveTitle: "Nuevo título",
      updatedAt: new Date().toISOString(),
    });

    render(<PreviewPageContent caseId="case-1" router={mockRouter} />);

    await waitFor(() => {
      expect(screen.getByTestId("trigger-content-title-rename")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("trigger-content-title-rename"));

    await waitFor(() => {
      expect(mockUpdateCase).toHaveBeenCalledTimes(1);
    });

    const [callId, callData] = mockUpdateCase.mock.calls[0];
    expect(callId).toBe("case-1");
    expect(callData).toEqual({ contentTitle: "Nuevo título" });

    await waitFor(() => {
      const props = capturedExportPanelProps[capturedExportPanelProps.length - 1];
      expect(props.displayTitle).toBe("Nuevo título");
    });

    expect(screen.getByTestId("export-display-title")).toHaveTextContent("Nuevo título");
  });
});
