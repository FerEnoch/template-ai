import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SaveContent } from "./page";
import { WizardProvider } from "@/lib/wizard/WizardContext";
import { WizardStep } from "@/lib/wizard/types";
import type { WizardState } from "@/lib/wizard/types";
import type { Entity } from "@template-ai/contracts";

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams({ step: WizardStep.SAVE }),
}));

const mockEntity: Entity = {
  id: "entity-1",
  label: "COMPRADOR",
  value: "Juan Pérez",
  group: "PARTES",
  confidence: "ALTA",
  sourceSpan: { start: 10, end: 20 },
  reviewed: true,
  excluded: false,
  userCreated: false,
};

const mockExcludedEntity: Entity = {
  id: "entity-2",
  label: "VENDEDOR",
  value: "María López",
  group: "PARTES",
  confidence: "ALTA",
  sourceSpan: { start: 30, end: 41 },
  reviewed: true,
  excluded: true,
  userCreated: false,
};

describe("SaveContent", () => {
  const baseState: WizardState = {
    currentStep: WizardStep.SAVE,
    file: { name: "test.pdf", size: 1000, type: "application/pdf" },
    analysisResultId: "analysis-123",
    entities: [mockEntity, mockExcludedEntity],
    extractedText: "Texto de prueba",
    templateForm: null,
  };

  const mockSetStep = vi.fn();
  const mockReset = vi.fn();
  const mockRouter = { push: vi.fn(), replace: vi.fn() };
  const mockSearchParams = new URLSearchParams({ step: WizardStep.SAVE });

  beforeEach(() => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "tmpl-1", createdAt: new Date().toISOString() }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("submits only non-excluded entities to /api/templates", async () => {
    render(
      <WizardProvider>
        <SaveContent
          state={baseState}
          setStep={mockSetStep}
          reset={mockReset}
          searchParams={mockSearchParams}
          router={mockRouter}
        />
      </WizardProvider>
    );

    const nameInput = screen.getByLabelText(/nombre de la plantilla/i);
    fireEvent.change(nameInput, { target: { value: "Plantilla de prueba" } });

    const submitButton = screen.getByRole("button", { name: /guardar en mi biblioteca/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/templates",
        expect.objectContaining({
          method: "POST",
          body: expect.any(String),
        })
      );
    });

    const [[, options]] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const body = JSON.parse(options.body as string);

    expect(body.entities).toHaveLength(1);
    expect(body.entities[0].id).toBe("entity-1");
    expect(body.entities).not.toContainEqual(
      expect.objectContaining({ id: "entity-2" })
    );
  });
});
