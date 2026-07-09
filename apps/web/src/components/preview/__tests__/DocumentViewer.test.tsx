import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { DocumentViewer } from "../DocumentViewer";

afterEach(() => {
  cleanup();
});

const CASE_ID = "case-123e4567-e89b-12d3-a456-426614174000";
const TITLE = "Contrato de Arrendamiento";
const GENERATED_TEXT =
  "Entre el COMPRADOR y la VENDEDORA se celebra el presente contrato.\n\nPrimera — Objeto.";

describe("DocumentViewer", () => {
  it("renders a static h1 when onRenameTitle is not provided", () => {
    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={GENERATED_TEXT}
      />
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(TITLE);
    expect(
      screen.queryByTestId("editable-title-icon")
    ).not.toBeInTheDocument();
  });

  it("shows the edit icon when hovering the title", () => {
    const onRenameTitle = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={GENERATED_TEXT}
        onRenameTitle={onRenameTitle}
      />
    );

    const wrapper = screen.getByTestId("editable-title-wrapper");
    expect(screen.getByTestId("editable-title-icon")).toHaveClass("opacity-0");

    fireEvent.mouseEnter(wrapper);
    expect(screen.getByTestId("editable-title-icon")).toHaveClass(
      "group-hover:opacity-100"
    );
  });

  it("enters edit mode with a pre-filled input when the icon is clicked", () => {
    const onRenameTitle = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={GENERATED_TEXT}
        onRenameTitle={onRenameTitle}
      />
    );

    fireEvent.click(screen.getByTestId("editable-title-icon"));

    const input = screen.getByTestId("editable-title-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(TITLE);
    expect(input).toHaveFocus();
  });

  it("calls onRenameTitle with the new name and an AbortSignal on Enter", async () => {
    const onRenameTitle = vi.fn(
      async (_name: string, _signal?: AbortSignal) => undefined
    );

    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={GENERATED_TEXT}
        onRenameTitle={onRenameTitle}
      />
    );

    fireEvent.click(screen.getByTestId("editable-title-icon"));
    const input = screen.getByTestId("editable-title-input");
    fireEvent.change(input, { target: { value: "Contrato Modificado" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(onRenameTitle).toHaveBeenCalledWith(
        "Contrato Modificado",
        expect.any(AbortSignal)
      );
    });
  });

  it("reverts to the original title and shows an inline error when onRenameTitle rejects", async () => {
    const onRenameTitle = vi.fn().mockRejectedValue(new Error("Save failed"));

    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={GENERATED_TEXT}
        onRenameTitle={onRenameTitle}
      />
    );

    fireEvent.click(screen.getByTestId("editable-title-icon"));
    const input = screen.getByTestId("editable-title-input");
    fireEvent.change(input, { target: { value: "Contrato Modificado" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeInTheDocument();
    });

    expect(screen.getByTestId("editable-title-input")).toHaveValue(TITLE);
  });
});
