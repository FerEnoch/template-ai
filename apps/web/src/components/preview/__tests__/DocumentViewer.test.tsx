import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import {
  DocumentViewer,
  isTitleParagraph,
  deriveTitle,
  ensureTitleText,
} from "../DocumentViewer";
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
const TITLE = "compraventa-test";
const DERIVED_TITLE = "Compraventa Test";
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
    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={GENERATED_TEXT}
      />
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(FIRST_PARAGRAPH);
    expect(heading).toHaveClass("font-headline");
    expect(
      screen.getByRole("button", { name: /editar título/i })
    ).toBeInTheDocument();
  });

  it("renders the remaining paragraphs as editable p elements", () => {
    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={GENERATED_TEXT}
      />
    );

    expect(screen.getByText(SECOND_PARAGRAPH)).toHaveRole("paragraph");
    expect(screen.getByText(THIRD_PARAGRAPH)).toHaveRole("paragraph");
  });

  it("allows editing the first paragraph rendered as h1", async () => {
    const onUpdate = vi.fn();

    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={GENERATED_TEXT}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /editar título/i }));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Nuevo Título" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockedUpdateCase).toHaveBeenCalledWith(
        CASE_ID,
        {
          generatedText:
            "Nuevo Título\n\nEntre el COMPRADOR y la VENDEDORA se celebra el presente contrato.\n\nPrimera — Objeto.",
        },
        expect.any(AbortSignal)
      );
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
      expect(mockedUpdateCase).toHaveBeenCalledWith(
        CASE_ID,
        {
          generatedText:
            "Compraventa\n\nTexto modificado del primer párrafo.\n\nPrimera — Objeto.",
        },
        expect.any(AbortSignal)
      );
    });

    expect(onUpdate).toHaveBeenCalledWith(
      "Compraventa\n\nTexto modificado del primer párrafo.\n\nPrimera — Objeto."
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

  it("does not abort the in-flight save when parent echoes optimistic generatedText", async () => {
    let resolveSave: (value: unknown) => void = () => undefined;
    let aborted = false;
    const savePromise = new Promise((resolve) => {
      resolveSave = resolve;
    });
    mockedUpdateCase.mockImplementation(
      (_id, _data, signal) =>
        new Promise((resolve, reject) => {
          const onAbort = () => {
            aborted = true;
            const err = new Error("Aborted");
            err.name = "AbortError";
            reject(err);
          };
          if (signal?.aborted) {
            onAbort();
            return;
          }
          signal?.addEventListener("abort", onAbort, { once: true });
          void savePromise.then((value) => {
            signal?.removeEventListener("abort", onAbort);
            if (!signal?.aborted) {
              resolve(value as never);
            }
          });
        })
    );

    let generatedText = GENERATED_TEXT;
    const onUpdate = vi.fn((text: string) => {
      generatedText = text;
      rerender(
        <DocumentViewer
          caseId={CASE_ID}
          title={TITLE}
          generatedText={generatedText}
          onUpdate={onUpdate}
        />
      );
    });

    const { rerender } = render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={generatedText}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /editar título/i }));
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Titulo Persistido" },
    });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockedUpdateCase).toHaveBeenCalled();
    });

    // Parent already echoed optimistic text; save must still complete.
    resolveSave({
      id: CASE_ID,
      name: null,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      templateId: "template-1",
      userId: "user-1",
      formData: {},
      generatedText:
        "Titulo Persistido\n\nEntre el COMPRADOR y la VENDEDORA se celebra el presente contrato.\n\nPrimera — Objeto.",
    });

    await waitFor(() => {
      expect(mockedUpdateCase).toHaveBeenCalledTimes(1);
    });
    expect(aborted).toBe(false);
    expect(
      screen.getByRole("heading", { name: "Titulo Persistido" })
    ).toBeInTheDocument();
  });

  it("applies a later external generatedText change after a no-op save", async () => {
    mockedUpdateCase.mockResolvedValue({
      id: CASE_ID,
      name: null,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      templateId: "template-1",
      userId: "user-1",
      formData: {},
      generatedText: GENERATED_TEXT,
    } as never);

    let generatedText = GENERATED_TEXT;
    const onUpdate = vi.fn((text: string) => {
      generatedText = text;
      rerender(
        <DocumentViewer
          caseId={CASE_ID}
          title={TITLE}
          generatedText={generatedText}
          onUpdate={onUpdate}
        />
      );
    });

    const { rerender } = render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={generatedText}
        onUpdate={onUpdate}
      />
    );

    // Save without changing text (no-op edit).
    fireEvent.click(screen.getByRole("button", { name: /editar título/i }));
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => {
      expect(mockedUpdateCase).toHaveBeenCalled();
    });

    // External regeneration replaces the document.
    const regenerated =
      "Documento Regenerado\n\nNuevo cuerpo del contrato regenerado.";
    generatedText = regenerated;
    rerender(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={generatedText}
        onUpdate={onUpdate}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Documento Regenerado" })
      ).toBeInTheDocument();
    });
  });

  describe("title detection", () => {
    it("returns true for a short title-like paragraph", () => {
      expect(isTitleParagraph("Compraventa")).toBe(true);
      expect(isTitleParagraph("Contrato de Locación")).toBe(true);
    });

    it("returns false for body text starters", () => {
      expect(isTitleParagraph("El presente documento es un contrato.")).toBe(
        false
      );
      expect(isTitleParagraph("En la ciudad de Buenos Aires...")).toBe(false);
      expect(isTitleParagraph("Entre los suscritos se acuerda")).toBe(false);
      expect(isTitleParagraph("Por medio de la presente")).toBe(false);
    });

    it("returns false for long paragraphs", () => {
      const longParagraph = "a".repeat(101);
      expect(isTitleParagraph(longParagraph)).toBe(false);
    });

    it("returns false for paragraphs ending with sentence punctuation", () => {
      expect(isTitleParagraph("Este es un párrafo.")).toBe(false);
      expect(isTitleParagraph("Primera cláusula;")).toBe(false);
      expect(isTitleParagraph("Objeto:")).toBe(false);
      expect(isTitleParagraph("¿Pregunta?")).toBe(false);
      expect(isTitleParagraph("¡Exclamación!")).toBe(false);
    });
  });

  describe("fallback title derivation", () => {
    it("capitalizes each segment of a hyphenated slug", () => {
      expect(deriveTitle("compraventa-test")).toBe("Compraventa Test");
      expect(deriveTitle("compraventa-inmobiliaria-gomez-morvan")).toBe(
        "Compraventa Inmobiliaria Gomez Morvan"
      );
    });

    it("capitalizes each word in a spaced display name", () => {
      expect(deriveTitle("contrato de locación")).toBe("Contrato De Locación");
    });

    it("ensureTitleText matches preview/export join contract for body-leading text", () => {
      const body = "El presente documento es un contrato.";
      expect(ensureTitleText(body, TITLE)).toBe(
        `${DERIVED_TITLE}\n\n${body}`
      );
    });
  });

  it("prepends a fallback title when the first paragraph looks like body text", () => {
    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={`El presente documento es un contrato de compraventa.\n\nPrimera — Objeto.`}
      />
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(DERIVED_TITLE);
    expect(
      screen.getByText("El presente documento es un contrato de compraventa.")
    ).toHaveRole("paragraph");
  });

  it("prepends a fallback title when the first paragraph is too long", () => {
    const longParagraph = "a".repeat(101);
    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={`${longParagraph}\n\nSegunda cláusula.`}
      />
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(DERIVED_TITLE);
  });

  it("does not prepend a fallback title when the first paragraph is a valid title", () => {
    render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText={`Compraventa\n\nEl presente documento es un contrato.`}
      />
    );

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Compraventa");
    expect(screen.queryByText(DERIVED_TITLE)).not.toBeInTheDocument();
  });

  it("updates the fallback title when the title prop changes", () => {
    const { rerender } = render(
      <DocumentViewer
        caseId={CASE_ID}
        title={TITLE}
        generatedText="El presente documento es un contrato."
      />
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      DERIVED_TITLE
    );

    rerender(
      <DocumentViewer
        caseId={CASE_ID}
        title="locación-comercial"
        generatedText="El presente documento es un contrato."
      />
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Locación Comercial"
    );
  });
});
