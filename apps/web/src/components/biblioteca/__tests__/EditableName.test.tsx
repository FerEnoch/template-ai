import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { EditableName } from "../EditableName";

afterEach(cleanup);

describe("EditableName", () => {
  it("renders children and enters edit mode on click", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditableName value="Original Name" onSave={onSave}>
        <h3>Original Name</h3>
      </EditableName>,
    );

    expect(screen.getByText("Original Name")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("editable-name-trigger"));

    const input = screen.getByTestId("editable-name-input");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Original Name");
  });

  it("saves the new name on Enter", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    function Wrapper() {
      const [name, setName] = useState("Original Name");
      return (
        <EditableName
          value={name}
          onSave={async (value) => {
            await onSave(value);
            setName(value);
          }}
        >
          <h3>{name}</h3>
        </EditableName>
      );
    }

    render(<Wrapper />);

    fireEvent.click(screen.getByTestId("editable-name-trigger"));
    const input = screen.getByTestId("editable-name-input");
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("New Name");
    });
    expect(screen.getByText("New Name")).toBeInTheDocument();
  });

  it("cancels editing and reverts the name on Escape", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditableName value="Original Name" onSave={onSave}>
        <h3>Original Name</h3>
      </EditableName>,
    );

    fireEvent.click(screen.getByTestId("editable-name-trigger"));
    const input = screen.getByTestId("editable-name-input");
    fireEvent.change(input, { target: { value: "Aborted Name" } });
    fireEvent.keyDown(input, { key: "Escape", code: "Escape" });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("Original Name")).toBeInTheDocument();
  });

  it("shows an inline error and stays in edit mode when the name is too short", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <EditableName value="Original Name" onSave={onSave}>
        <h3>Original Name</h3>
      </EditableName>,
    );

    fireEvent.click(screen.getByTestId("editable-name-trigger"));
    const input = screen.getByTestId("editable-name-input");
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/al menos 3 caracteres/i)).toBeInTheDocument();
    expect(input).toBeInTheDocument();
  });

  it("rolls back to the previous name when onSave throws", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Save failed"));

    render(
      <EditableName value="Original Name" onSave={onSave}>
        <h3>Original Name</h3>
      </EditableName>,
    );

    fireEvent.click(screen.getByTestId("editable-name-trigger"));
    const input = screen.getByTestId("editable-name-input");
    fireEvent.change(input, { target: { value: "New Name" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("New Name");
    });

    await waitFor(() => {
      expect(screen.getByTestId("editable-name-trigger")).toHaveTextContent(
        "Original Name",
      );
    });
  });

  it("stops click propagation so the card link is not triggered", () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const parentClick = vi.fn();

    render(
      <div onClick={parentClick}>
        <EditableName value="Original Name" onSave={onSave}>
          <h3>Original Name</h3>
        </EditableName>
      </div>,
    );

    fireEvent.click(screen.getByTestId("editable-name-trigger"));

    expect(parentClick).not.toHaveBeenCalled();
  });
});
