import type { Entity } from "@template-ai/contracts";
import type { ReactNode } from "react";

interface HighlightOptions {
  hoveredEntityId?: string | null;
}

export function renderHighlightedText(
  text: string,
  entities: Entity[],
  options?: HighlightOptions,
): ReactNode {
  const sorted = entities
    .filter((entity) => entity.sourceSpan)
    .sort((a, b) => a.sourceSpan!.start - b.sourceSpan!.start);

  if (sorted.length === 0) {
    return <span>{text}</span>;
  }

  const segments: ReactNode[] = [];
  let lastEnd = 0;

  for (const entity of sorted) {
    const span = entity.sourceSpan!;
    const clampedStart = Math.max(span.start, lastEnd);

    if (clampedStart >= span.end) {
      continue;
    }

    if (clampedStart > lastEnd) {
      segments.push(
        <span key={`text-${lastEnd}`}>{text.slice(lastEnd, clampedStart)}</span>,
      );
    }

    const isHovered = entity.id === options?.hoveredEntityId;

    const colorClass =
      entity.confidence === "ALTA"
        ? isHovered
          ? "bg-success/35 border-b-2 border-success"
          : "bg-success/20 border-b-2 border-success/50"
        : isHovered
          ? "bg-warning/35 border-b-2 border-warning"
          : "bg-warning/20 border-b-2 border-warning/50";

    segments.push(
      <mark
        key={entity.id}
        className={`rounded px-0.5 ${colorClass} cursor-help`}
        title={`${entity.label}: ${entity.value}`}
      >
        {text.slice(clampedStart, span.end)}
      </mark>,
    );

    lastEnd = Math.max(lastEnd, span.end);
  }

  if (lastEnd < text.length) {
    segments.push(<span key={`text-${lastEnd}`}>{text.slice(lastEnd)}</span>);
  }

  return <>{segments}</>;
}
