"use client";

import { cn } from "@/lib/utils";
import type { Entity } from "@template-ai/contracts";
import type { FieldType } from "@/lib/case/inferFieldType";

interface FieldRendererProps {
  readonly entity: Entity;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onBlur?: () => void;
  readonly error?: string;
  readonly fieldType: FieldType;
}

export function FieldRenderer({
  entity,
  value,
  onChange,
  onBlur,
  error,
  fieldType,
}: FieldRendererProps) {
  const inputClassName = cn(
    "w-full rounded border bg-surface p-3 font-body text-sm text-text-primary transition-colors focus:border-text-primary focus:outline-none",
    error ? "border-danger" : "border-border"
  );

  if (fieldType === "checkbox") {
    const checked = value === "true";
    return (
      <div className="flex items-center gap-3 rounded border border-border bg-background p-4">
        <input
          id={entity.id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
          onBlur={onBlur}
          className="h-5 w-5 rounded border-border text-text-primary focus:ring-text-primary"
        />
        <label
          htmlFor={entity.id}
          className="font-label text-sm font-medium text-text-primary"
        >
          {entity.label}
        </label>
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 md:grid-cols-4">
      <label
        htmlFor={entity.id}
        className="font-label text-sm font-semibold text-text-primary md:col-span-1"
      >
        {entity.label} <span className="text-danger">*</span>
      </label>
      <div className="md:col-span-2">
        <input
          id={entity.id}
          type={fieldType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className={inputClassName}
          placeholder={`Ingresá ${entity.label.toLowerCase()}`}
        />
        {error && (
          <p className="mt-2 flex items-center gap-1 text-xs font-medium text-danger">
            <span aria-hidden>!</span>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
