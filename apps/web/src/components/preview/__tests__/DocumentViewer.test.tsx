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
const GENERATED_TEXT =
  "Compraventa\n\nEntre el COMPRADOR y la VENDEDORA se celebra el presente contrato.\n\nPrimera — Objeto.";

const FIRST_PARAGRAPH = "Compraventa";
const SECOND_PARAGRAPH =
  "Entre el COMPRADOR y la VENDEDORA se celebra el presente contrato.";
const THIRD_PARAGRAPH = "Primera — Objeto.";

describe("DocumentViewer", () => {
  beforeEach(() => {
    mockedUpdateCase.mockResolvedValue({
      id: CASE_ID,
      name: null,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      templateId: "template-1",
      userId: "user-1",
      formData: { generatedText: GENERATED_TEXT },
    });
  });

  it("renders the first paragraph as an editable h1", () => {
    render(<DocumentViewer caseId={CASE_ID} generatedText={GENERATED_TEXT} />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(FIRST_PARAGRAPH);
    expect(heading).toHaveClass("font-headline");
    expect(
      screen.getByRole("button", { name: /editar título/i })
    ).toBeInTheDocument();
  });

  it("renders the remaining paragraphs as editable p elements", () => {
    render(<DocumentViewer caseId={CASE_ID} generatedText={GENERATED_TEXT} />);

    expect(screen.getByText(SECOND_PARAGRAPH)).toHaveRole("paragraph");
    expect(screen.getByText(THIRD_PARAGRAPH)).toHaveRole("paragraph");
  });

  it("allows editing the first paragraph rendered as h1", async () => {
    const onUpdate = vi.fn();

    render(
      <DocumentViewer
        caseId={CASE_ID}
        generatedText={GENERATED_TEXT}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /editar título/i }));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Nuevo Título" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockedUpdateCase).toHaveBeenCalledWith(CASE_ID, {
        formData: {
          generatedText:
            "Nuevo Título\n\nEntre el COMPRADOR y la VENDEDORA se celebra el presente contrato.\n\nPrimera — Objeto.",
        },
      });
    });

    expect(onUpdate).toHaveBeenCalledWith(
      "Nuevo Título\n\nEntre el COMPRADOR y la VENDEDORA se celebra el presente contrato.\n\nPrimera — Objeto."
    );
  });

  it("calls onUpdate with the full text after saving a paragraph", async () => {
    const onUpdate = vi.fn();

    render(
      <DocumentViewer
        caseId={CASE_ID}
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
          generatedText:
            "Compraventa\n\nTexto modificado del primer párrafo.\n\nPrimera — Objeto.",
        },
      });
    });

    expect(onUpdate).toHaveBeenCalledWith(
      "Compraventa\n\nTexto modificado del primer párrafo.\n\nPrimera — Objeto."
    );
  });

  it("displays an error message when saving a paragraph fails", async () => {
    mockedUpdateCase.mockRejectedValue(new Error("Save failed"));

    render(<DocumentViewer caseId={CASE_ID} generatedText={GENERATED_TEXT} />);

    fireEvent.click(screen.getAllByLabelText("Editar párrafo")[0]);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Otro cambio." } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeInTheDocument();
    });
  });
});
