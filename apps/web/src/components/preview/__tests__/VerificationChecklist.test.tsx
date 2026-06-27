import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { VerificationChecklist } from "../VerificationChecklist";

afterEach(() => {
  cleanup();
});

describe("VerificationChecklist", () => {
  it("renders the three verification sections", () => {
    render(<VerificationChecklist />);
    expect(screen.getByText("Estructura")).toBeInTheDocument();
    expect(screen.getByText("Datos")).toBeInTheDocument();
    expect(screen.getByText("Fechas")).toBeInTheDocument();
  });

  it("expands a section to reveal its checkbox", () => {
    render(<VerificationChecklist />);
    fireEvent.click(screen.getByRole("button", { name: /estructura/i }));
    expect(
      screen.getByLabelText(/¿Contiene cláusulas, partes y objeto\?/i)
    ).toBeInTheDocument();
  });

  it("toggles check state locally", () => {
    render(<VerificationChecklist />);
    fireEvent.click(screen.getByRole("button", { name: /datos/i }));
    const checkbox = screen.getByLabelText(/Datos completos/i);

    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });
});
