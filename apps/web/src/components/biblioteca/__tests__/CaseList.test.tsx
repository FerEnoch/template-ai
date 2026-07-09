import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { CaseList } from "../CaseList";
import type { Case, Template } from "@template-ai/contracts";

afterEach(cleanup);

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Contrato Base",
    description: "Descripción",
    documentId: "00000000-0000-0000-0000-000000000002",
    entities: [],
    category: "legal",
    createdAt: "2025-01-01T00:00:00.000Z",
    status: "draft",
    ...overrides,
  };
}

function makeCase(overrides: Partial<Case> = {}): Case {
  return {
    id: "00000000-0000-0000-0000-000000000003",
    userId: 0,
    templateId: "00000000-0000-0000-0000-000000000001",
    status: "borrador",
    name: null,
    formData: {},
    generatedText: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CaseList", () => {
  it("displays template name when case name is null", () => {
    const template = makeTemplate({ name: "Contrato Base" });
    const caseItem = makeCase({ name: null });

    render(
      <CaseList
        cases={[caseItem]}
        templates={[template]}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText("Contrato Base")).toBeInTheDocument();
  });

  it("displays custom case name when provided", () => {
    const template = makeTemplate({ name: "Contrato Base" });
    const caseItem = makeCase({ name: "Documento Personalizado" });

    render(
      <CaseList
        cases={[caseItem]}
        templates={[template]}
        isLoading={false}
        error={null}
      />,
    );

    expect(screen.getByText("Documento Personalizado")).toBeInTheDocument();
    expect(screen.queryByText("Contrato Base")).not.toBeInTheDocument();
  });

  it("calls onRename with the new case name", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const template = makeTemplate({ name: "Contrato Base" });
    const caseItem = makeCase({ name: null });

    render(
      <CaseList
        cases={[caseItem]}
        templates={[template]}
        isLoading={false}
        error={null}
        onRename={onRename}
      />,
    );

    fireEvent.click(screen.getByTestId("editable-name-trigger"));
    const input = screen.getByTestId("editable-name-input");
    fireEvent.change(input, { target: { value: "Caso Renombrado" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000003",
        "Caso Renombrado",
      );
    });
  });
});
