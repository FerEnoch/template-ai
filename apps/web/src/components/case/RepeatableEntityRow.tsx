"use client";

import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Entity } from "@template-ai/contracts";

interface RepeatableEntityRowProps {
  readonly entity: Entity;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onRemove: () => void;
  readonly error?: string;
}

export function RepeatableEntityRow({
  entity,
  value,
  onChange,
  onRemove,
  error,
}: RepeatableEntityRowProps) {
  return (
    <div
      className={cn(
        "relative flex flex-wrap items-center gap-4 rounded-lg border bg-background p-4 md:flex-nowrap",
        error ? "border-danger" : "border-border"
      )}
    >
      <div className="w-full md:w-1/2">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-text-disabled">
          {entity.label}
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full rounded border bg-surface p-2 font-body text-sm text-text-primary focus:border-text-primary focus:outline-none",
            error ? "border-danger" : "border-border"
          )}
        />
        {error && (
          <p className="mt-1 text-xs font-medium text-danger">{error}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-3 top-3 text-text-disabled transition-colors hover:text-danger"
        aria-label={`Eliminar ${entity.label}`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
