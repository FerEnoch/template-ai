import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { EntityInspector } from "./EntityInspector";
import type { Entity } from "@template-ai/contracts";

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

const MOCK_ENTITIES: Entity[] = [
  {
    id: "entity-1",
    label: "COMPRADOR",
    value: "Juan Pérez",
    group: "PARTES",
    confidence: "ALTA",
    sourceSpan: { start: 10, end: 20 },
    reviewed: false,
    excluded: false,
    userCreated: false,
  },
  {
    id: "entity-2",
    label: "VENDEDOR",
    value: "María López",
    group: "PARTES",
    confidence: "MEDIA",
    sourceSpan: { start: 30, end: 45 },
    reviewed: true,
    excluded: false,
    userCreated: false,
  },
  {
    id: "entity-3",
    label: "DIRECCIÓN",
    value: "Av. Corrientes 1234",
    group: "INMUEBLE",
    confidence: "ALTA",
    sourceSpan: { start: 50, end: 70 },
    reviewed: false,
    excluded: false,
    userCreated: false,
  },
];

describe("EntityInspector", () => {
  const defaultProps = {
    entities: MOCK_ENTITIES,
    onEntityUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders entity groups with correct labels", () => {
    render(<EntityInspector {...defaultProps} />);

    expect(screen.getByText("Partes")).toBeInTheDocument();
    expect(screen.getByText("Inmueble")).toBeInTheDocument();
  });

  it("renders entities within their groups", () => {
    render(<EntityInspector {...defaultProps} />);

    // Click to expand PARTES group (it's expanded by default)
    expect(screen.getByText("COMPRADOR")).toBeInTheDocument();
    expect(screen.getByText("Juan Pérez")).toBeInTheDocument();
    expect(screen.getByText("VENDEDOR")).toBeInTheDocument();
    expect(screen.getByText("María López")).toBeInTheDocument();
  });

  it("shows entity count badge in group headers", () => {
    render(<EntityInspector {...defaultProps} />);

    // PARTES has 2 entities
    const partesBadges = screen.getAllByText("2");
    expect(partesBadges.length).toBeGreaterThan(0);

    // INMUEBLE has 1 entity
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  describe("+ AGREGAR CAMPO button", () => {
    it("renders button in group headers when onAddEntity is provided", () => {
      const onAddEntity = vi.fn();
      render(
        <EntityInspector
          {...defaultProps}
          onAddEntity={onAddEntity}
          manualEntityCount={0}
        />
      );

      const addButtons = screen.getAllByRole("button", {
        name: /agregar campo/i,
      });
      expect(addButtons.length).toBeGreaterThan(0);
    });

    it("does not render button when onAddEntity is not provided", () => {
      render(<EntityInspector {...defaultProps} />);

      expect(
        screen.queryByRole("button", { name: /agregar campo/i })
      ).not.toBeInTheDocument();
    });

    it("calls onAddEntity when button is clicked", () => {
      const onAddEntity = vi.fn();
      render(
        <EntityInspector
          {...defaultProps}
          onAddEntity={onAddEntity}
          manualEntityCount={0}
        />
      );

      const addButtons = screen.getAllByRole("button", {
        name: /agregar campo/i,
      });
      fireEvent.click(addButtons[0]);

      expect(onAddEntity).toHaveBeenCalledOnce();
    });

    it("disables button when manual entity limit is reached", () => {
      const onAddEntity = vi.fn();
      render(
        <EntityInspector
          {...defaultProps}
          onAddEntity={onAddEntity}
          manualEntityCount={5}
          manualEntityLimit={5}
        />
      );

      const addButtons = screen.getAllByRole("button", {
        name: /agregar campo/i,
      });
      addButtons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it("shows tooltip when button is disabled at limit", () => {
      const onAddEntity = vi.fn();
      render(
        <EntityInspector
          {...defaultProps}
          onAddEntity={onAddEntity}
          manualEntityCount={5}
          manualEntityLimit={5}
        />
      );

      const addButtons = screen.getAllByRole("button", {
        name: /agregar campo/i,
      });
      addButtons.forEach((button) => {
        expect(button).toHaveAttribute(
          "title",
          "Límite de 5 campos manuales alcanzado"
        );
      });
    });

    it("renders button in empty state for groups with no entities", () => {
      const onAddEntity = vi.fn();
      const emptyEntities: Entity[] = [
        {
          id: "entity-1",
          label: "COMPRADOR",
          value: "Juan Pérez",
          group: "PARTES",
          confidence: "ALTA",
          reviewed: false,
          excluded: false,
          userCreated: false,
        },
      ];

      render(
        <EntityInspector
          entities={emptyEntities}
          onAddEntity={onAddEntity}
          manualEntityCount={0}
        />
      );

      // Should show empty state for FECHAS and ANEXOS with buttons
      const addButtons = screen.getAllByRole("button", {
        name: /agregar campo/i,
      });
      expect(addButtons.length).toBeGreaterThan(0);
    });

    it("replaces hardcoded 'No se han detectado anexos' with dynamic empty state", () => {
      const onAddEntity = vi.fn();
      const emptyEntities: Entity[] = [
        {
          id: "entity-1",
          label: "COMPRADOR",
          value: "Juan Pérez",
          group: "PARTES",
          confidence: "ALTA",
          reviewed: false,
          excluded: false,
          userCreated: false,
        },
      ];

      render(
        <EntityInspector
          entities={emptyEntities}
          onAddEntity={onAddEntity}
          manualEntityCount={0}
        />
      );

      // Should show dynamic empty state text for each group
      expect(screen.getByText("No se han detectado fechas")).toBeInTheDocument();
      expect(screen.getByText("No se han detectado anexos")).toBeInTheDocument();
    });
  });

  it("shows 'Con traza' badge for entities with sourceSpan", () => {
    render(<EntityInspector {...defaultProps} />);

    const trazaBadges = screen.getAllByText("Con traza");
    expect(trazaBadges.length).toBeGreaterThan(0);
  });

  it("opens edit modal when entity row is clicked", () => {
    render(<EntityInspector {...defaultProps} />);

    const entityRow = screen.getByText("Juan Pérez").closest("button");
    expect(entityRow).toBeInTheDocument();

    fireEvent.click(entityRow!);

    // Modal should open with entity details
    expect(screen.getByText("Editar entidad")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Juan Pérez")).toBeInTheDocument();
  });

  describe("onEntityHover", () => {
    it("calls onEntityHover with entity id on mouseEnter", () => {
      const onEntityHover = vi.fn();
      render(
        <EntityInspector {...defaultProps} onEntityHover={onEntityHover} />,
      );

      const entityRow = screen.getByText("Juan Pérez").closest("button")!;
      fireEvent.mouseEnter(entityRow);

      expect(onEntityHover).toHaveBeenCalledWith("entity-1");
    });

    it("calls onEntityHover with null on mouseLeave", () => {
      const onEntityHover = vi.fn();
      render(
        <EntityInspector {...defaultProps} onEntityHover={onEntityHover} />,
      );

      const entityRow = screen.getByText("Juan Pérez").closest("button")!;
      fireEvent.mouseLeave(entityRow);

      expect(onEntityHover).toHaveBeenCalledWith(null);
    });

    it("calls onEntityHover for entities without sourceSpan", () => {
      const onEntityHover = vi.fn();
      const entitiesWithoutSpan: Entity[] = [
        {
          id: "entity-no-span",
          label: "NOTARIO",
          value: "Dr. García",
          group: "PARTES",
          confidence: "ALTA",
          reviewed: false,
          excluded: false,
          userCreated: false,
        },
      ];

      render(
        <EntityInspector
          entities={entitiesWithoutSpan}
          onEntityUpdate={vi.fn()}
          onEntityHover={onEntityHover}
        />,
      );

      const entityRow = screen.getByText("Dr. García").closest("button")!;
      fireEvent.mouseEnter(entityRow);

      expect(onEntityHover).toHaveBeenCalledWith("entity-no-span");
    });

    it("calls onEntityHover for excluded entities", () => {
      const onEntityHover = vi.fn();
      const excludedEntity: Entity = {
        id: "entity-excluded",
        label: "EXCLUIDO",
        value: "Valor excluido",
        group: "PARTES",
        confidence: "ALTA",
        reviewed: false,
        excluded: true,
        userCreated: false,
      };

      render(
        <EntityInspector
          entities={[excludedEntity]}
          onEntityUpdate={vi.fn()}
          onEntityHover={onEntityHover}
        />,
      );

      // Show excluded entities first (hidden by default)
      const toggleButton = screen.getByText(/Mostrar entidades excluidas/);
      fireEvent.click(toggleButton);

      const entityRow = screen.getByText("Valor excluido").closest("button")!;
      fireEvent.mouseEnter(entityRow);

      expect(onEntityHover).toHaveBeenCalledWith("entity-excluded");
    });

    it("does not throw when onEntityHover is not provided", () => {
      render(<EntityInspector {...defaultProps} />);

      const entityRow = screen.getByText("Juan Pérez").closest("button")!;

      expect(() => {
        fireEvent.mouseEnter(entityRow);
        fireEvent.mouseLeave(entityRow);
      }).not.toThrow();
    });
  });
});
