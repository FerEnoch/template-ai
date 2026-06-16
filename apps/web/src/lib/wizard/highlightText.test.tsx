import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import type { Entity } from "@template-ai/contracts";
import { renderHighlightedText } from "./highlightText";

afterEach(() => {
  cleanup();
});

function createEntity(
  id: string,
  start: number | undefined,
  end: number | undefined,
  confidence: Entity["confidence"] = "ALTA",
): Entity {
  return {
    id,
    label: `LABEL_${id}`,
    value: `value-${id}`,
    group: "PARTES",
    confidence,
    sourceSpan:
      typeof start === "number" && typeof end === "number"
        ? { start, end }
        : undefined,
    reviewed: false,
    excluded: false,
  };
}

describe("renderHighlightedText", () => {
  it("renders highlighted marks for entities with sourceSpan", () => {
    const text = "Juan Pérez firma en Madrid";
    const entities: Entity[] = [
      createEntity("1", 0, 10, "ALTA"),
      createEntity("2", 20, 26, "MEDIA"),
    ];

    render(<div>{renderHighlightedText(text, entities)}</div>);

    const marks = screen.getAllByText(/Juan Pérez|Madrid/);
    expect(marks).toHaveLength(2);
    expect(marks[0].tagName.toLowerCase()).toBe("mark");
    expect(marks[1].tagName.toLowerCase()).toBe("mark");
  });

  it("returns plain text when entities are empty", () => {
    const text = "Sin entidades";
    render(<div>{renderHighlightedText(text, [])}</div>);

    expect(screen.getByText("Sin entidades")).toBeInTheDocument();
    expect(document.querySelectorAll("mark")).toHaveLength(0);
  });

  it("skips entities without sourceSpan", () => {
    const text = "Contrato de arrendamiento";
    const entities: Entity[] = [createEntity("1", undefined, undefined)];

    render(<div>{renderHighlightedText(text, entities)}</div>);

    expect(screen.getByText(text)).toBeInTheDocument();
    expect(document.querySelectorAll("mark")).toHaveLength(0);
  });

  it("renders overlapping spans deterministically", () => {
    const text = "ABCDEFGHIJ";
    const entities: Entity[] = [
      createEntity("1", 0, 6, "ALTA"),
      createEntity("2", 4, 9, "BAJA"),
    ];

    const { container } = render(<div>{renderHighlightedText(text, entities)}</div>);

    expect(document.querySelectorAll("mark")).toHaveLength(2);
    expect(container.textContent).toBe(text);
  });

  it("skips fully contained spans without duplicating text", () => {
    const text = "ABCDEFGHIJ";
    const entities: Entity[] = [
      createEntity("1", 0, 8, "ALTA"),
      createEntity("2", 2, 5, "MEDIA"),
    ];

    const { container } = render(<div>{renderHighlightedText(text, entities)}</div>);

    expect(document.querySelectorAll("mark")).toHaveLength(1);
    expect(container.textContent).toBe(text);
  });

  describe("hover variant", () => {
    it("applies elevated classes when hoveredEntityId matches an ALTA entity", () => {
      const text = "Juan Pérez firma en Madrid";
      const entities: Entity[] = [
        createEntity("1", 0, 10, "ALTA"),
        createEntity("2", 20, 26, "MEDIA"),
      ];

      render(
        <div>
          {renderHighlightedText(text, entities, { hoveredEntityId: "1" })}
        </div>,
      );

      const marks = document.querySelectorAll("mark");
      expect(marks).toHaveLength(2);

      // Hovered ALTA entity gets elevated classes
      expect(marks[0].className).toContain("bg-success/35");
      expect(marks[0].className).toContain("border-success");
      expect(marks[0].className).not.toContain("bg-success/20");

      // Non-hovered entity keeps default classes
      expect(marks[1].className).toContain("bg-warning/20");
      expect(marks[1].className).toContain("border-warning/50");
    });

    it("keeps default classes when hoveredEntityId does not match any entity", () => {
      const text = "Juan Pérez firma en Madrid";
      const entities: Entity[] = [
        createEntity("1", 0, 10, "ALTA"),
        createEntity("2", 20, 26, "MEDIA"),
      ];

      render(
        <div>
          {renderHighlightedText(text, entities, {
            hoveredEntityId: "non-existent",
          })}
        </div>,
      );

      const marks = document.querySelectorAll("mark");
      expect(marks).toHaveLength(2);

      // All marks keep default classes
      expect(marks[0].className).toContain("bg-success/20");
      expect(marks[0].className).toContain("border-success/50");
      expect(marks[1].className).toContain("bg-warning/20");
      expect(marks[1].className).toContain("border-warning/50");
    });

    it("keeps default classes when hoveredEntityId is null", () => {
      const text = "Juan Pérez firma en Madrid";
      const entities: Entity[] = [
        createEntity("1", 0, 10, "ALTA"),
        createEntity("2", 20, 26, "MEDIA"),
      ];

      render(
        <div>
          {renderHighlightedText(text, entities, { hoveredEntityId: null })}
        </div>,
      );

      const marks = document.querySelectorAll("mark");
      expect(marks).toHaveLength(2);

      // All marks keep default classes
      expect(marks[0].className).toContain("bg-success/20");
      expect(marks[0].className).toContain("border-success/50");
      expect(marks[1].className).toContain("bg-warning/20");
      expect(marks[1].className).toContain("border-warning/50");
    });
  });
});
