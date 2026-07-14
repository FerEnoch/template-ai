import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { SuggestedGroupChips } from "./SuggestedGroupChips";

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("SuggestedGroupChips", () => {
  it("renders a chip for each pending group", () => {
    render(
      <SuggestedGroupChips
        groups={["JORNADA", "GARANTES"]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />
    );

    expect(screen.getByText("JORNADA")).toBeInTheDocument();
    expect(screen.getByText("GARANTES")).toBeInTheDocument();
  });

  it("calls onApprove when the approve button is clicked", async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    render(
      <SuggestedGroupChips groups={["JORNADA"]} onApprove={onApprove} onReject={vi.fn()} />
    );

    fireEvent.click(screen.getByLabelText(/aprobar grupo jornada/i));

    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith("JORNADA");
    });
  });

  it("calls onReject when the reject button is clicked", async () => {
    const onReject = vi.fn().mockResolvedValue(undefined);
    render(
      <SuggestedGroupChips groups={["JORNADA"]} onApprove={vi.fn()} onReject={onReject} />
    );

    fireEvent.click(screen.getByLabelText(/rechazar grupo jornada/i));

    await waitFor(() => {
      expect(onReject).toHaveBeenCalledWith("JORNADA");
    });
  });

  it("does not render anything when groups is empty", () => {
    const { container } = render(
      <SuggestedGroupChips groups={[]} onApprove={vi.fn()} onReject={vi.fn()} />
    );

    expect(container.firstChild).toBeNull();
  });

  it("disables buttons while an action is in progress", async () => {
    let resolveApprove: (() => void) | undefined;
    const onApprove = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveApprove = resolve;
        })
    );

    render(
      <SuggestedGroupChips groups={["JORNADA"]} onApprove={onApprove} onReject={vi.fn()} />
    );

    const approveButton = screen.getByLabelText(/aprobar grupo jornada/i);
    fireEvent.click(approveButton);

    expect(approveButton).toBeDisabled();

    resolveApprove?.();
    await waitFor(() => {
      expect(approveButton).not.toBeDisabled();
    });
  });
});
