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
import { EditableTitle } from "../EditableTitle";

afterEach(cleanup);

describe("EditableTitle", () => {
  it("renders children and hides the edit icon by default", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditableTitle value="Original Title" onSave={onSave}>
        <h1>Original Title</h1>
      </EditableTitle>
    );

    expect(screen.getByText("Original Title")).toBeInTheDocument();
    expect(screen.getByTestId("editable-title-icon")).toHaveClass("opacity-0");
  });

  it("shows the edit icon on hover", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditableTitle value="Original Title" onSave={onSave}>
        <h1>Original Title</h1>
      </EditableTitle>
    );

    const wrapper = screen.getByTestId("editable-title-wrapper");
    fireEvent.mouseEnter(wrapper);

    expect(screen.getByTestId("editable-title-icon")).toHaveClass(
      "group-hover:opacity-100"
    );
  });

  it("enters edit mode with a focused, pre-filled input when the icon is clicked", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditableTitle value="Original Title" onSave={onSave}>
        <h1>Original Title</h1>
      </EditableTitle>
    );

    fireEvent.click(screen.getByTestId("editable-title-icon"));

    const input = screen.getByTestId("editable-title-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Original Title");
    expect(input).toHaveFocus();
  });

  it("saves the new title on Enter", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    function Wrapper() {
      const [title, setTitle] = useState("Original Title");
      return (
        <EditableTitle
          value={title}
          onSave={async (value) => {
            await onSave(value);
            setTitle(value);
          }}
        >
          <h1>{title}</h1>
        </EditableTitle>
      );
    }

    render(<Wrapper />);

    fireEvent.click(screen.getByTestId("editable-title-icon"));
    const input = screen.getByTestId("editable-title-input");
    fireEvent.change(input, { target: { value: "New Title" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("New Title");
    });
    expect(screen.getByText("New Title")).toBeInTheDocument();
  });

  it("saves the new title on blur", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    function Wrapper() {
      const [title, setTitle] = useState("Original Title");
      return (
        <EditableTitle
          value={title}
          onSave={async (value) => {
            await onSave(value);
            setTitle(value);
          }}
        >
          <h1>{title}</h1>
        </EditableTitle>
      );
    }

    render(<Wrapper />);

    fireEvent.click(screen.getByTestId("editable-title-icon"));
    const input = screen.getByTestId("editable-title-input");
    fireEvent.change(input, { target: { value: "Blurred Title" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("Blurred Title");
    });
    expect(screen.getByText("Blurred Title")).toBeInTheDocument();
  });

  it("reverts to the original title on Escape", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditableTitle value="Original Title" onSave={onSave}>
        <h1>Original Title</h1>
      </EditableTitle>
    );

    fireEvent.click(screen.getByTestId("editable-title-icon"));
    const input = screen.getByTestId("editable-title-input");
    fireEvent.change(input, { target: { value: "Aborted Title" } });
    fireEvent.keyDown(input, { key: "Escape", code: "Escape" });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Original Title")).toBeInTheDocument();
  });

  it("exits edit mode without calling onSave when the value is unchanged", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditableTitle value="Original Title" onSave={onSave}>
        <h1>Original Title</h1>
      </EditableTitle>
    );

    fireEvent.click(screen.getByTestId("editable-title-icon"));
    const input = screen.getByTestId("editable-title-input");
    fireEvent.blur(input);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Original Title")).toBeInTheDocument();
  });

  it("exits edit mode without calling onSave when the trimmed value is unchanged", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditableTitle value="Original Title" onSave={onSave}>
        <h1>Original Title</h1>
      </EditableTitle>
    );

    fireEvent.click(screen.getByTestId("editable-title-icon"));
    const input = screen.getByTestId("editable-title-input");
    fireEvent.change(input, { target: { value: "  Original Title  " } });
    fireEvent.blur(input);

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Original Title")).toBeInTheDocument();
  });

  it("shows an inline error and stays in edit mode when the title is too short", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditableTitle value="Original Title" onSave={onSave}>
        <h1>Original Title</h1>
      </EditableTitle>
    );

    fireEvent.click(screen.getByTestId("editable-title-icon"));
    const input = screen.getByTestId("editable-title-input");
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/al menos 3 caracteres/i)).toBeInTheDocument();
    expect(input).toBeInTheDocument();
  });

  it("rejects whitespace-only values as too short", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditableTitle value="Original Title" onSave={onSave}>
        <h1>Original Title</h1>
      </EditableTitle>
    );

    fireEvent.click(screen.getByTestId("editable-title-icon"));
    const input = screen.getByTestId("editable-title-input");
    fireEvent.change(input, { target: { value: "     " } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/al menos 3 caracteres/i)).toBeInTheDocument();
    expect(input).toBeInTheDocument();
  });

  it("reverts to the original value and shows the error when onSave rejects", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Save failed"));

    render(
      <EditableTitle value="Original Title" onSave={onSave}>
        <h1>Original Title</h1>
      </EditableTitle>
    );

    fireEvent.click(screen.getByTestId("editable-title-icon"));
    const input = screen.getByTestId("editable-title-input");
    fireEvent.change(input, { target: { value: "New Title" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("New Title");
    });

    await waitFor(() => {
      expect(screen.getByText("Save failed")).toBeInTheDocument();
    });

    expect(screen.getByTestId("editable-title-input")).toHaveValue(
      "Original Title"
    );
  });

  it("stops click propagation so the parent link is not triggered", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <EditableTitle value="Original Title" onSave={onSave}>
          <h1>Original Title</h1>
        </EditableTitle>
      </div>
    );

    fireEvent.click(screen.getByTestId("editable-title-icon"));

    expect(parentClick).not.toHaveBeenCalled();
  });
});
