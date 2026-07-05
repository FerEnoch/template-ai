import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { TemplateCard } from "../TemplateCard";
import type { Template } from "@template-ai/contracts";

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

describe("TemplateCard", () => {
  it("renders template name and triggers rename on save", async () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const template = makeTemplate();

    render(<TemplateCard template={template} onRename={onRename} />);

    expect(screen.getByText("Contrato Base")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("editable-name-trigger"));
    const input = screen.getByTestId("editable-name-input");
    fireEvent.change(input, { target: { value: "Nuevo Nombre" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(onRename).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001",
        "Nuevo Nombre",
      );
    });
  });

  it("does not call onRename when name is unchanged", () => {
    const onRename = vi.fn().mockResolvedValue(undefined);
    const template = makeTemplate();

    render(<TemplateCard template={template} onRename={onRename} />);

    fireEvent.click(screen.getByTestId("editable-name-trigger"));
    const input = screen.getByTestId("editable-name-input");
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(onRename).not.toHaveBeenCalled();
  });
});
