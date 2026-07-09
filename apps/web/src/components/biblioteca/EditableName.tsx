"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { cn } from "@/lib/utils";

interface EditableNameProps {
  readonly value: string;
  readonly onSave: (value: string) => Promise<void>;
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
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  // Synchronous guard against the double-save triggered when `disabled={isPending}`
  // blurs the input right after Enter/blur starts a transition. `isPending` only
  // flips on the next React render, so a ref is needed to block the blur handler
  // running in the same tick.
  const savingRef = useRef(false);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!isEditing) {
      setDraft(value);
      setError(null);
    }
  }, [value, isEditing]);

  const validate = useCallback(
    (raw: string): string | null => {
      const trimmed = raw.trim();
      if (trimmed.length < minLength) {
        return `El nombre debe tener al menos ${minLength} caracteres.`;
      }
      if (trimmed.length > maxLength) {
        return `El nombre no puede tener más de ${maxLength} caracteres.`;
      }
      return null;
    },
    [minLength, maxLength],
  );

  const handleStartEdit = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Clicking the editable area should not trigger parent navigation.
      e.preventDefault();
      e.stopPropagation();
      // Prevent the focus from moving away from the soon-to-be-rendered input.
      e.currentTarget.focus();
      setIsEditing(true);
      setDraft(value);
      setError(null);
    },
    [value],
  );

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setDraft(value);
    setError(null);
  }, [value]);

  const handleSave = useCallback(() => {
    if (savingRef.current) return; // a save is already in-flight (Enter or blur)
    const trimmed = draft.trim();
    const validationError = validate(trimmed);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (trimmed === value) {
      setIsEditing(false);
      return;
    }

    const previousValue = value;
    // Optimistically update local state so the input feels responsive.
    setDraft(trimmed);
    // Hold the guard synchronously so the blur triggered by `disabled={isPending}`
    // does not fire a second `onSave` with the same value.
    savingRef.current = true;

    startTransition(async () => {
      try {
        await onSave(trimmed);
        setIsEditing(false);
        setError(null);
      } catch (err) {
        // Rollback on error so the user can retry with the previous name.
        setDraft(previousValue);
        setError(
          err instanceof Error
            ? err.message
            : "Error al guardar el nombre. Intentá nuevamente.",
        );
        // Keep edit mode open so the inline error is visible and retryable.
      } finally {
        savingRef.current = false;
      }
    });
  }, [draft, value, validate, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel],
  );

  const handleBlur = useCallback(() => {
    handleSave();
  }, [handleSave]);

  const handleWrapperClick = useCallback((e: React.MouseEvent) => {
    // Prevent clicks inside the editable wrapper from bubbling to the card link.
    e.preventDefault();
    e.stopPropagation();
  }, []);

  if (!isEditing) {
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label="Editar nombre"
        data-testid="editable-name-trigger"
        onClick={handleStartEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsEditing(true);
          }
        }}
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
        onChange={(e) => setDraft(e.target.value)}
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
          className={
            errorClassName ??
            "mt-1 text-xs font-bold text-danger"
          }
        >
          {error}
        </p>
      )}
    </div>
  );
}
