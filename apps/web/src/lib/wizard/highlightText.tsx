import type { Entity } from "@template-ai/contracts";
import type { ReactNode } from "react";

export function renderHighlightedText(text: string, entities: Entity[]): ReactNode {
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

    if (span.start > lastEnd) {
      segments.push(
        <span key={`text-${lastEnd}`}>{text.slice(lastEnd, span.start)}</span>,
      );
    }

    const colorClass =
      entity.confidence === "ALTA"
        ? "bg-success/20 border-b-2 border-success/50"
        : "bg-warning/20 border-b-2 border-warning/50";

    segments.push(
      <mark
        key={entity.id}
        className={`rounded px-0.5 ${colorClass} cursor-help`}
        title={`${entity.label}: ${entity.value}`}
      >
        {text.slice(span.start, span.end)}
      </mark>,
    );

    lastEnd = Math.max(lastEnd, span.end);
  }

  if (lastEnd < text.length) {
    segments.push(<span key={`text-${lastEnd}`}>{text.slice(lastEnd)}</span>);
  }

  return <>{segments}</>;
}
