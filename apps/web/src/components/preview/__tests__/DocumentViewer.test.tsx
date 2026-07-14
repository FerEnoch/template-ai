import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { DocumentViewer } from "../DocumentViewer";
import { updateCase } from "@/lib/api/cases";

vi.mock("@/lib/api/cases", () => ({
  updateCase: vi.fn(),
}));

const mockedUpdateCase = vi.mocked(updateCase);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const CASE_ID = "case-123e4567-e89b-12d3-a456-426614174000";
const TITLE = "Contrato de Arrendamiento";
const GENERATED_TEXT =
  "Entre el COMPRADOR y la VENDEDORA se celebra el presente contrato.\n\nPrimera — Objeto.";

describe("DocumentViewer", () => {
  beforeEach(() => {
    mockedUpdateCase.mockResolvedValue({
      id: CASE_ID,
      name: TITLE,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      templateId: "template-1",
      userId: "user-1",
      formData: { generatedText: GENERATED_TEXT },
    });
  });

  it("renders the filename as read-only text", () => {
    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={GENERATED_TEXT}
      />
    );

    const label = screen.getByTestId("filename-label");
    expect(label).toHaveTextContent(`Documento: ${TITLE}`);
    expect(label).not.toHaveAttribute("contenteditable");
  });

  it("does not render an editable title control", () => {
    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={GENERATED_TEXT}
      />
    );

    expect(
      screen.queryByTestId("editable-title-icon")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("editable-title-input")
    ).not.toBeInTheDocument();
  });

  it("renders editable paragraphs for the generated text", () => {
    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={GENERATED_TEXT}
      />
    );

    expect(
      screen.getByText("Entre el COMPRADOR y la VENDEDORA se celebra el presente contrato.")
    ).toBeInTheDocument();
    expect(screen.getByText("Primera — Objeto.")).toBeInTheDocument();
  });

  it("calls onUpdate with the full text after saving a paragraph", async () => {
    const onUpdate = vi.fn();

    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={GENERATED_TEXT}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getAllByLabelText("Editar párrafo")[0]);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, {
      target: { value: "Texto modificado del primer párrafo." },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockedUpdateCase).toHaveBeenCalledWith(CASE_ID, {
        formData: {
          generatedText: "Texto modificado del primer párrafo.\n\nPrimera — Objeto.",
        },
      });
    });

    expect(onUpdate).toHaveBeenCalledWith(
      "Texto modificado del primer párrafo.\n\nPrimera — Objeto."
    );
  });

  it("displays an error message when saving a paragraph fails", async () => {
    mockedUpdateCase.mockRejectedValue(new Error("Save failed"));

    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={GENERATED_TEXT}
      />
    );

    fireEvent.click(screen.getAllByLabelText("Editar párrafo")[0]);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Otro cambio." } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeInTheDocument();
    });
  });
});
