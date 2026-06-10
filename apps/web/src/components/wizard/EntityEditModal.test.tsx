import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { EntityEditModal } from "./EntityEditModal";
import type { Entity } from "@template-ai/contracts";

// Polyfill HTMLDialogElement for jsdom (which lacks native <dialog> support)
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
});

afterEach(() => {
  cleanup();
});

const MOCK_ENTITY: Entity = {
  id: "test-entity-1",
  label: "COMPRADOR",
  value: "Juan Pérez",
  group: "PARTES",
  confidence: "ALTA",
  sourceSpan: { start: 10, end: 20 },
  reviewed: false,
  excluded: false,
};

const MOCK_ENTITY_BAJA: Entity = {
  ...MOCK_ENTITY,
  id: "test-entity-2",
  confidence: "BAJA",
  excluded: false,
};

const MOCK_ENTITY_EXCLUDED: Entity = {
  ...MOCK_ENTITY,
  id: "test-entity-3",
  excluded: true,
};

describe("EntityEditModal", () => {
  const defaultProps = {
    entity: MOCK_ENTITY,
    isOpen: true,
    onSave: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders entity label, value input, and confidence badge", () => {
    render(<EntityEditModal {...defaultProps} />);

    // Label is shown as read-only heading
    expect(screen.getByText("Editar entidad")).toBeInTheDocument();
    expect(screen.getByText("COMPRADOR")).toBeInTheDocument();

    // Value input renders with current value
    const valueInput = screen.getByDisplayValue("Juan Pérez");
    expect(valueInput).toBeInTheDocument();

    // Confidence toggle shows ALTA and BAJA
    expect(screen.getByText("ALTA")).toBeInTheDocument();
    expect(screen.getByText("BAJA")).toBeInTheDocument();

    // ALTA is active since entity.confidence is ALTA
    const altaButton = screen.getByText("ALTA");
    expect(altaButton.closest("button")).toHaveClass("border-success");
  });

  it("clicking Excluir toggles the excluded state and shows Restaurar", () => {
    render(<EntityEditModal {...defaultProps} />);

    // Initially shows "Excluir entidad" button
    const excluirBtn = screen.getByText("Excluir entidad");
    expect(excluirBtn).toBeInTheDocument();

    // Click to exclude
    fireEvent.click(excluirBtn);

    // Now shows "Restaurar entidad" and excluded message
    expect(screen.getByText("Restaurar entidad")).toBeInTheDocument();
    expect(
      screen.getByText("Esta entidad será excluida del documento final")
    ).toBeInTheDocument();

    // Click to restore
    const restaurarBtn = screen.getByText("Restaurar entidad");
    fireEvent.click(restaurarBtn);

    // Back to "Excluir entidad"
    expect(screen.getByText("Excluir entidad")).toBeInTheDocument();
  });

  it("clicking Guardar calls onSave with updated entity", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EntityEditModal {...defaultProps} onSave={onSave} />);

    // Change the value
    const valueInput = screen.getByDisplayValue("Juan Pérez");
    fireEvent.change(valueInput, { target: { value: "María López" } });

    // Click save
    const saveBtn = screen.getByText("Guardar cambios");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledOnce();
    });

    const savedEntity = onSave.mock.calls[0][0] as Entity;
    expect(savedEntity.value).toBe("María López");
    expect(savedEntity.confidence).toBe("ALTA");
    expect(savedEntity.reviewed).toBe(true);
    expect(savedEntity.id).toBe("test-entity-1");
  });

  it("clicking Cancelar calls onClose", () => {
    const onClose = vi.fn();
    render(<EntityEditModal {...defaultProps} onClose={onClose} />);

    const cancelBtn = screen.getByText("Cancelar");
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("displays error message when save fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("Network error"));
    render(<EntityEditModal {...defaultProps} onSave={onSave} />);

    const saveBtn = screen.getByText("Guardar cambios");
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("initializes with entity BAJA confidence selected when entity has BAJA", () => {
    render(
      <EntityEditModal {...defaultProps} entity={MOCK_ENTITY_BAJA} />
    );

    // BAJA should be shown as active
    const bajaButton = screen.getByText("BAJA");
    expect(bajaButton.closest("button")).toHaveClass("border-danger");
  });

  it("initializes with excluded state when entity is excluded", () => {
    render(
      <EntityEditModal {...defaultProps} entity={MOCK_ENTITY_EXCLUDED} />
    );

    // Should show "Restaurar" when entity is already excluded
    expect(screen.getByText("Restaurar entidad")).toBeInTheDocument();
  });

  it("calls onClose when X button is clicked", () => {
    const onClose = vi.fn();
    render(<EntityEditModal {...defaultProps} onClose={onClose} />);

    const closeBtn = screen.getByLabelText("Cerrar");
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("returns null when entity is null", () => {
    const { container } = render(
      <EntityEditModal {...defaultProps} entity={null} />
    );

    expect(container.innerHTML).toBe("");
  });

  describe("create mode", () => {
    const createEntity: Entity = {
      id: "create-entity-1",
      label: "Arrendatario",
      value: "María García",
      group: "PARTES",
      confidence: "ALTA",
      sourceSpan: { start: 50, end: 62 },
      reviewed: false,
      excluded: false,
      userCreated: true,
    };

    const createProps = {
      ...defaultProps,
      entity: createEntity,
      mode: "create" as const,
    };

    it("renders create mode title and subtitle", () => {
      render(<EntityEditModal {...createProps} />);

      expect(screen.getByText("Agregar entidad")).toBeInTheDocument();
      expect(
        screen.getByText("Confirmá los datos detectados por IA")
      ).toBeInTheDocument();
    });

    it("renders label as editable text input in create mode", () => {
      render(<EntityEditModal {...createProps} />);

      // Label should be an input field, not read-only div
      const labelInput = screen.getByDisplayValue("Arrendatario");
      expect(labelInput.tagName).toBe("INPUT");
      expect(labelInput).not.toHaveAttribute("readonly");
    });

    it("renders group dropdown in create mode", () => {
      render(<EntityEditModal {...createProps} />);

      // Group dropdown should be visible
      const groupSelect = screen.getByRole("combobox");
      expect(groupSelect).toBeInTheDocument();

      // All group options should be available
      expect(screen.getByText("Partes")).toBeInTheDocument();
      expect(screen.getByText("Inmueble")).toBeInTheDocument();
      expect(screen.getByText("Fechas")).toBeInTheDocument();
      expect(screen.getByText("Anexos")).toBeInTheDocument();
    });

    it("locks confidence to ALTA in create mode (disabled toggle)", () => {
      render(<EntityEditModal {...createProps} />);

      // ALTA should be shown but not clickable (or visually disabled)
      const altaButton = screen.getByText("ALTA").closest("button");
      expect(altaButton).toBeDisabled();

      // BAJA option should not be present in create mode
      expect(screen.queryByText("BAJA")).not.toBeInTheDocument();
    });

    it("does not show exclude button in create mode", () => {
      render(<EntityEditModal {...createProps} />);

      expect(screen.queryByText("Excluir entidad")).not.toBeInTheDocument();
      expect(screen.queryByText("Restaurar entidad")).not.toBeInTheDocument();
    });

    it("calls onSave with entity data when Agregar is clicked", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(<EntityEditModal {...createProps} onSave={onSave} />);

      // Change label
      const labelInput = screen.getByDisplayValue("Arrendatario");
      fireEvent.change(labelInput, { target: { value: "Arrendador" } });

      // Change group
      const groupSelect = screen.getByRole("combobox");
      fireEvent.change(groupSelect, { target: { value: "INMUEBLE" } });

      // Click Agregar button
      const addBtn = screen.getByText("Agregar");
      fireEvent.click(addBtn);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledOnce();
      });

      const savedEntity = onSave.mock.calls[0][0] as Entity;
      expect(savedEntity.label).toBe("Arrendador");
      expect(savedEntity.group).toBe("INMUEBLE");
      expect(savedEntity.confidence).toBe("ALTA");
      expect(savedEntity.userCreated).toBe(true);
    });

    it("shows Cancelar button that calls onClose", () => {
      const onClose = vi.fn();
      render(<EntityEditModal {...createProps} onClose={onClose} />);

      const cancelBtn = screen.getByText("Cancelar");
      fireEvent.click(cancelBtn);

      expect(onClose).toHaveBeenCalledOnce();
    });
  });
});