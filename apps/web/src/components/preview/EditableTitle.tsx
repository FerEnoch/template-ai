"use client";

import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useInlineEdit } from "@/components/biblioteca/useInlineEdit";

export interface EditableTitleProps {
  readonly value: string;
  readonly onSave: (
    value: string,
    signal?: AbortSignal
  ) => Promise<void>;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly inputClassName?: string;
  readonly errorClassName?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
}

export function EditableTitle({
  value,
  onSave,
  children,
  className,
  inputClassName,
  errorClassName,
  minLength = 3,
  maxLength = 200,
}: EditableTitleProps) {
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
  } = useInlineEdit({
    value,
    onSave,
    minLength,
    maxLength,
  });

  const handleIconClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    startEdit();
  };

  const handleWrapperClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  if (!isEditing) {
    return (
      <div
        onClick={handleWrapperClick}
        className={cn("group relative inline-block", className)}
        data-testid="editable-title-wrapper"
      >
        {children}
        <button
          type="button"
          onClick={handleIconClick}
          aria-label="Editar título"
          data-testid="editable-title-icon"
          className="absolute -right-8 top-1/2 -translate-y-1/2 p-1 text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-stone-900 focus:opacity-100"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={handleWrapperClick}
      className={cn("w-full", className)}
      data-testid="editable-title-wrapper"
    >
      <input
        ref={inputRef}
        type="text"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={isPending}
        maxLength={maxLength}
        aria-label="Editar título"
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? "editable-title-error" : undefined}
        data-testid="editable-title-input"
        className={cn(
          inputClassName ??
            "w-full rounded-md border border-border bg-surface px-2 py-1 text-center font-headline text-3xl font-bold leading-tight text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
          isPending && "animate-pulse opacity-80"
        )}
      />
      {error && (
        <p
          id="editable-title-error"
          data-testid="editable-title-error"
          className={errorClassName ?? "mt-2 text-center text-sm font-bold text-danger"}
        >
          {error}
        </p>
      )}
    </div>
  );
}
