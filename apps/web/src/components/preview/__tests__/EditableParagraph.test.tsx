import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { EditableParagraph } from "../EditableParagraph";

afterEach(() => {
  cleanup();
});

describe("EditableParagraph", () => {
  it("renders the paragraph text", () => {
    render(<EditableParagraph text="Test paragraph." index={0} onSave={vi.fn()} />);
    expect(screen.getByText("Test paragraph.")).toBeInTheDocument();
  });

  it("enters editable mode when the edit button is clicked", () => {
    render(<EditableParagraph text="Editable content." index={1} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /editar/i }));

    expect(screen.getByRole("textbox")).toHaveValue("Editable content.");
    expect(screen.getByRole("button", { name: /guardar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeInTheDocument();
  });

  it("calls onSave with the edited text when Guardar is clicked", () => {
    const onSave = vi.fn();
    render(<EditableParagraph text="Original." index={2} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: /editar/i }));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Updated paragraph." } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    expect(onSave).toHaveBeenCalledWith(2, "Updated paragraph.");
  });

  it("reverts to the original text when Cancelar is clicked", () => {
    const onSave = vi.fn();
    render(<EditableParagraph text="Original." index={3} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: /editar/i }));
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Discarded changes." } });
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Original.")).toBeInTheDocument();
  });
});
