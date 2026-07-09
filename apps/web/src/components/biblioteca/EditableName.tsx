"use client";

import { cn } from "@/lib/utils";
import { useInlineEdit } from "./useInlineEdit";

interface EditableNameProps {
  readonly value: string;
  readonly onSave: (value: string, signal?: AbortSignal) => Promise<void>;
  readonly children: React.ReactNode;
  readonly inputClassName?: string;
  readonly errorClassName?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
}

export function EditableName({
  value,
  onSave,
  children,
  inputClassName,
  errorClassName,
  minLength = 3,
  maxLength = 200,
}: EditableNameProps) {
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

  const handleStartEdit = (event: React.MouseEvent<HTMLDivElement>) => {
    // Clicking the editable area should not trigger parent navigation.
    event.preventDefault();
    event.stopPropagation();
    // Prevent the focus from moving away from the soon-to-be-rendered input.
    event.currentTarget.focus();
    startEdit();
  };

  const handleWrapperClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Prevent clicks inside the editable wrapper from bubbling to the card link.
    event.preventDefault();
    event.stopPropagation();
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startEdit();
    }
  };

  if (!isEditing) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Editar nombre"
        data-testid="editable-name-trigger"
        onClick={handleStartEdit}
        onKeyDown={handleTriggerKeyDown}
        className="cursor-text"
      >
        {children}
      </div>
    );
  }

  return (
    <div onClick={handleWrapperClick} className="w-full">
      <input
        ref={inputRef}
        type="text"
        value={draft}
        data-testid="editable-name-input"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        disabled={isPending}
        aria-label="Editar nombre"
        aria-invalid={error ? "true" : "false"}
        aria-describedby={error ? "editable-name-error" : undefined}
        className={cn(
          inputClassName ??
            "w-full rounded-md border border-border bg-surface px-2 py-1 font-headline text-base font-semibold leading-tight text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
          isPending && "animate-pulse opacity-80",
        )}
      />
      {error && (
        <p
          id="editable-name-error"
          className={errorClassName ?? "mt-1 text-xs font-bold text-danger"}
        >
          {error}
        </p>
      )}
    </div>
  );
}
