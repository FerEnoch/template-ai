import { describe, it, expect, afterEach, vi, beforeAll } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ConfirmDeleteDialog } from "../ConfirmDeleteDialog";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("ConfirmDeleteDialog", () => {
  it("renders the itemName in the title and body", () => {
    render(
      <ConfirmDeleteDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        isLoading={false}
        itemName="Caso #3"
      />,
    );

    expect(screen.getByText(/¿Eliminar "Caso #3"?/)).toBeInTheDocument();
    expect(
      screen.getByText(/Estás por eliminar "Caso #3"/),
    ).toBeInTheDocument();
  });
});
