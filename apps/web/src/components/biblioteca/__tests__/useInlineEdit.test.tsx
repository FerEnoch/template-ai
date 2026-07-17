import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import {
  useInlineEdit,
  type UseInlineEditOptions,
} from "../useInlineEdit";

afterEach(cleanup);

interface HarnessProps {
  readonly value: string;
  readonly onSave: UseInlineEditOptions["onSave"];
  readonly minLength?: number;
  readonly maxLength?: number;
}

function Harness({ value, onSave, minLength, maxLength }: HarnessProps) {
  const {
    isEditing,
    draft,
    setDraft,
    error,
    isPending,
    inputRef,
    startEdit,
    handleKeyDown,
    handleBlur,
  } = useInlineEdit({ value, onSave, minLength, maxLength });

  return (
    <div>
      {!isEditing ? (
        <div
          data-testid="trigger"
          onClick={startEdit}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              startEdit();
            }
          }}
          role="button"
          tabIndex={0}
        >
          {value}
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            data-testid="input"
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
          />
          {isPending && <span data-testid="pending">Guardando...</span>}
        </>
      )}
      {error && <p data-testid="error">{error}</p>}
    </div>
  );
}

describe("useInlineEdit", () => {
  it("saves the new value on Enter", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    function Wrapper() {
      const [name, setName] = useState("Original Name");
      return (
        <Harness
          value={name}
          onSave={async (value) => {
            await onSave(value);
            setName(value);
          }}
        />
      );
    }

    render(<Wrapper />);

    fireEvent.click(screen.getByTestId("trigger"));
    const input = screen.getByTestId("input");
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("New Name");
    });
    await waitFor(() => {
      expect(screen.getByText("New Name")).toBeInTheDocument();
    });
  });

  it("cancels editing and reverts the value on Escape", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<Harness value="Original Name" onSave={onSave} />);

    fireEvent.click(screen.getByTestId("trigger"));
    const input = screen.getByTestId("input");
    fireEvent.change(input, { target: { value: "Aborted Name" } });
    fireEvent.keyDown(input, { key: "Escape", code: "Escape" });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Original Name")).toBeInTheDocument();
  });

  it("exits edit mode without calling onSave when the value is unchanged", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<Harness value="Original Name" onSave={onSave} />);

    fireEvent.click(screen.getByTestId("trigger"));
    const input = screen.getByTestId("input");
    fireEvent.blur(input);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Original Name")).toBeInTheDocument();
  });

  it("exits edit mode without calling onSave when the trimmed value is unchanged", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<Harness value="Original Name" onSave={onSave} />);

    fireEvent.click(screen.getByTestId("trigger"));
    const input = screen.getByTestId("input");
    fireEvent.change(input, { target: { value: "  Original Name  " } });
    fireEvent.blur(input);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Original Name")).toBeInTheDocument();
  });

  it("shows an inline error and stays in edit mode when the value is too short", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<Harness value="Original Name" onSave={onSave} />);

    fireEvent.click(screen.getByTestId("trigger"));
    const input = screen.getByTestId("input");
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/al menos 3 caracteres/i)).toBeInTheDocument();
    expect(screen.getByTestId("input")).toBeInTheDocument();
  });

  it("rejects whitespace-only values as too short", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<Harness value="Original Name" onSave={onSave} />);

    fireEvent.click(screen.getByTestId("trigger"));
    const input = screen.getByTestId("input");
    fireEvent.change(input, { target: { value: "     " } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/al menos 3 caracteres/i)).toBeInTheDocument();
    expect(screen.getByTestId("input")).toBeInTheDocument();
  });

  it("reverts to the original value and shows the error when onSave rejects", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Save failed"));

    render(<Harness value="Original Name" onSave={onSave} />);

    fireEvent.click(screen.getByTestId("trigger"));
    const input = screen.getByTestId("input");
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("New Name");
    });

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeInTheDocument();
    });

    expect(screen.getByTestId("input")).toHaveValue("Original Name");
  });

  it("ignores AbortError from a superseded save", async () => {
    const savePromises: Promise<void>[] = [];
    const onSave = (_value: string, signal?: AbortSignal) => {
      let rejectRef: (reason?: unknown) => void;
      const promise = new Promise<void>((_, reject) => {
        rejectRef = reject;
        signal?.addEventListener("abort", () => {
          reject(new DOMException("AbortError", "AbortError"));
        });
      });
      // Store a no-op catch so the test does not treat the rejection as unhandled
      // if the harness itself ignores it.
      promise.catch(() => {});
      savePromises.push(promise);
      return promise;
    };

    render(
      <Harness
        value="Original Name"
        onSave={onSave}
      />
    );

    fireEvent.click(screen.getByTestId("trigger"));
    const input = screen.getByTestId("input");
    fireEvent.change(input, { target: { value: "First Name" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(screen.getByTestId("pending")).toBeInTheDocument();
    });

    // Simulate a concurrent edit that aborts the first request.
    fireEvent.change(input, { target: { value: "Second Name" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(savePromises).toHaveLength(2);
    });

    // The first promise should have rejected with AbortError.
    await expect(savePromises[0]).rejects.toThrow("AbortError");

    // The second (active) save must still be pending; no error should be shown.
    expect(screen.queryByTestId("error")).not.toBeInTheDocument();
    expect(screen.getByTestId("input")).toHaveValue("Second Name");
  });

  it("aborts the in-flight save on unmount", async () => {
    const savePromises: Promise<void>[] = [];
    const onSave = (_value: string, signal?: AbortSignal) => {
      let rejectRef: (reason?: unknown) => void;
      const promise = new Promise<void>((_, reject) => {
        rejectRef = reject;
        signal?.addEventListener("abort", () => {
          reject(new DOMException("AbortError", "AbortError"));
        });
      });
      promise.catch(() => {});
      savePromises.push(promise);
      return promise;
    };

    const { unmount } = render(
      <Harness value="Original Name" onSave={onSave} />
    );

    fireEvent.click(screen.getByTestId("trigger"));
    const input = screen.getByTestId("input");
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(savePromises).toHaveLength(1);
    });

    unmount();

    await expect(savePromises[0]).rejects.toThrow("AbortError");
  });
});
