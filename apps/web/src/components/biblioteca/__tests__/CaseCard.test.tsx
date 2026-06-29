import { describe, it, expect, afterEach, vi, beforeAll } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { CaseCard } from "../CaseList";
import type { Case } from "@template-ai/contracts";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function makeCase(overrides: Partial<Case> = {}): Case {
  return {
    id: "case-uuid-1",
    userId: 1,
    templateId: "tmpl-uuid-1",
    status: "borrador",
    formData: {},
    generatedText: null,
    createdAt: "2025-06-01T10:00:00Z",
    updatedAt: "2025-06-01T10:00:00Z",
    ...overrides,
  };
}

describe("CaseCard", () => {
  it("hides the Trash2 button for archived cases", () => {
    render(
      <CaseCard
        caseData={makeCase({ status: "archivado" })}
        displayName="Caso #1"
      />,
    );

    expect(
      screen.queryByRole("button", { name: /eliminar/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the Trash2 button for active cases", () => {
    render(
      <CaseCard
        caseData={makeCase({ status: "borrador" })}
        displayName="Caso #1"
      />,
    );

    const button = screen.getByRole("button", { name: /eliminar/i });
    expect(button).toBeInTheDocument();
  });

  it("reveals the Trash2 button on hover", async () => {
    render(
      <CaseCard
        caseData={makeCase({ status: "borrador" })}
        displayName="Caso #1"
      />,
    );

    const button = screen.getByRole("button", { name: /eliminar/i });
    expect(button).toHaveClass("opacity-0");
    expect(button).toHaveClass("group-hover:opacity-100");

    const card = screen.getByRole("link");
    fireEvent.mouseEnter(card);

    expect(button).toHaveClass("group-hover:opacity-100");
  });

  it("shows a loading spinner and disables the button while deleting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );

    render(
      <CaseCard
        caseData={makeCase({ status: "borrador" })}
        displayName="Caso #1"
      />,
    );

    const button = screen.getByRole("button", { name: /eliminar/i });
    fireEvent.click(button);

    const confirmButton = screen.getByRole("button", { name: /^eliminar$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /eliminar/i })).toBeDisabled();
    });
  });

  it("calls onDelete with the case id on successful deletion", async () => {
    const onDelete = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(new Response(null, { status: 204 })),
      ),
    );

    render(
      <CaseCard
        caseData={makeCase({ id: "case-uuid-1", status: "borrador" })}
        displayName="Caso #1"
        onDelete={onDelete}
      />,
    );

    const button = screen.getByRole("button", { name: /eliminar/i });
    fireEvent.click(button);

    const confirmButton = screen.getByRole("button", { name: /^eliminar$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith("case-uuid-1");
    });
  });

  it("displays an inline error banner and calls onDeleteError when deletion fails", async () => {
    const onDeleteError = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("Network error"))),
    );

    render(
      <CaseCard
        caseData={makeCase({ status: "borrador" })}
        displayName="Caso #1"
        onDeleteError={onDeleteError}
      />,
    );

    const button = screen.getByRole("button", { name: /eliminar/i });
    fireEvent.click(button);

    const confirmButton = screen.getByRole("button", { name: /^eliminar$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
    expect(onDeleteError).toHaveBeenCalledTimes(1);
  });

  it("calls fetch DELETE /api/cases/:id when confirmed", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <CaseCard
        caseData={makeCase({ id: "case-uuid-1", status: "borrador" })}
        displayName="Caso #1"
      />,
    );

    const button = screen.getByRole("button", { name: /eliminar/i });
    fireEvent.click(button);

    const confirmButton = screen.getByRole("button", { name: /^eliminar$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/cases/case-uuid-1", {
        method: "DELETE",
      });
    });
  });
});
