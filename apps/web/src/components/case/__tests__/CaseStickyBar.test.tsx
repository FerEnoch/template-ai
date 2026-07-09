import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CaseStickyBar } from "../CaseStickyBar";

afterEach(() => {
  cleanup();
});

describe("CaseStickyBar", () => {
  it('disables "Generar documento" when progress is below 80%', () => {
    render(
      <CaseStickyBar
        progress={79}
        filled={7}
        total={11}
        status="idle"
        error={null}
        onSave={vi.fn()}
        onGenerate={vi.fn()}
      />
    );
    const generateButton = screen.getByRole("button", { name: /generar documento/i });
    expect(generateButton).toBeDisabled();
  });

  it('enables "Generar documento" when progress is exactly 80%', () => {
    render(
      <CaseStickyBar
        progress={80}
        filled={8}
        total={10}
        status="idle"
        error={null}
        onSave={vi.fn()}
        onGenerate={vi.fn()}
      />
    );
    const generateButton = screen.getByRole("button", { name: /generar documento/i });
    expect(generateButton).toBeEnabled();
  });

  it('enables "Generar documento" when progress is above 80%', () => {
    render(
      <CaseStickyBar
        progress={85}
        filled={17}
        total={20}
        status="idle"
        error={null}
        onSave={vi.fn()}
        onGenerate={vi.fn()}
      />
    );
    const generateButton = screen.getByRole("button", { name: /generar documento/i });
    expect(generateButton).toBeEnabled();
  });

  it('calls onSave when "Guardar borrador" is clicked', async () => {
    const onSave = vi.fn();
    render(
      <CaseStickyBar
        progress={50}
        filled={5}
        total={10}
        status="idle"
        error={null}
        onSave={onSave}
        onGenerate={vi.fn()}
      />
    );
    const saveButton = screen.getByRole("button", { name: /guardar borrador/i });
    fireEvent.click(saveButton);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows saving status text when status is saving", () => {
    render(
      <CaseStickyBar
        progress={50}
        filled={5}
        total={10}
        status="saving"
        error={null}
        onSave={vi.fn()}
        onGenerate={vi.fn()}
      />
    );
    expect(screen.getByText(/guardando/i)).toBeInTheDocument();
  });

  it("shows generating indicator and disables both buttons when generating", () => {
    const onSave = vi.fn();
    const onGenerate = vi.fn();
    render(
      <CaseStickyBar
        progress={100}
        filled={10}
        total={10}
        status="generating"
        error={null}
        onSave={onSave}
        onGenerate={onGenerate}
      />
    );
    expect(screen.getByText(/generando documento/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generando/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /guardar borrador/i })).toBeDisabled();
  });

  it("shows error message inline when error is provided", () => {
    render(
      <CaseStickyBar
        progress={100}
        filled={10}
        total={10}
        status="idle"
        error="Error al generar el documento"
        onSave={vi.fn()}
        onGenerate={vi.fn()}
      />
    );
    expect(screen.getByText(/error al generar el documento/i)).toBeInTheDocument();
  });
});
