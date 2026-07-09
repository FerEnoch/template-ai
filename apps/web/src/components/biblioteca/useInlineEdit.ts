"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export interface UseInlineEditOptions {
  readonly value: string;
  readonly onSave: (
    value: string,
    signal?: AbortSignal
  ) => Promise<void>;
  readonly minLength?: number;
  readonly maxLength?: number;
}

export interface UseInlineEditResult {
  readonly isEditing: boolean;
  readonly draft: string;
  readonly setDraft: (value: string) => void;
  readonly error: string | null;
  readonly isPending: boolean;
  readonly inputRef: React.RefObject<HTMLInputElement | null>;
  readonly startEdit: () => void;
  readonly cancel: () => void;
  readonly save: () => void;
  readonly handleKeyDown: (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => void;
  readonly handleBlur: () => void;
}

export function useInlineEdit({
  value,
  onSave,
  minLength = 3,
  maxLength = 200,
}: UseInlineEditOptions): UseInlineEditResult {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
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

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  const validate = useCallback(
    (trimmed: string): string | null => {
      if (trimmed.length < minLength) {
        return `El nombre debe tener al menos ${minLength} caracteres.`;
      }
      if (trimmed.length > maxLength) {
        return `El nombre no puede tener más de ${maxLength} caracteres.`;
      }
      return null;
    },
    [minLength, maxLength]
  );

  const startEdit = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = null;
    savingRef.current = false;
    setIsPending(false);
    setIsEditing(true);
    setDraft(value);
    setError(null);
  }, [value]);

  const cancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    savingRef.current = false;
    setIsPending(false);
    setIsEditing(false);
    setDraft(value);
    setError(null);
  }, [value]);

  const save = useCallback(() => {
    const trimmed = draft.trim();
    const validationError = validate(trimmed);

    if (validationError) {
      setError(validationError);
      return;
    }

    if (trimmed === value.trim()) {
      setIsEditing(false);
      setError(null);
      return;
    }

    // Cancel any in-flight save so only the latest value is persisted.
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;
    savingRef.current = true;

    const previousValue = value;
    setDraft(trimmed);
    setIsPending(true);

    const executeSave = async () => {
      try {
        // Backward compatibility: older one-argument handlers (e.g. existing
        // tests and card callbacks) are not forwarded an AbortSignal. New
        // handlers that declare the second parameter receive the signal so the
        // API call can be cancelled on supersede or unmount.
        if (onSave.length >= 2) {
          await onSave(trimmed, controller.signal);
        } else {
          await onSave(trimmed);
        }
        setIsEditing(false);
        setError(null);
      } catch (err) {
        // A superseded or unmount-aborted save must not revert the value or
        // surface an error.
        if (controller.signal.aborted) {
          return;
        }
        setDraft(previousValue);
        setError(
          err instanceof Error
            ? err.message
            : "Error al guardar el nombre. Intentá nuevamente."
        );
      } finally {
        // Only the latest controller resets the guard; a stale finally from an
        // aborted request must not clear the new save's state.
        if (abortRef.current === controller) {
          savingRef.current = false;
          setIsPending(false);
          abortRef.current = null;
        }
      }
    };

    void executeSave();
  }, [draft, value, validate, onSave]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        save();
      } else if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      }
    },
    [save, cancel]
  );

  const handleBlur = useCallback(() => {
    // The disabled attribute (bound to isPending) blurs the input immediately
    // after Enter starts a save. Without this guard the same value would be
    // saved twice in the same tick.
    if (savingRef.current) {
      return;
    }
    save();
  }, [save]);

  return {
    isEditing,
    draft,
    setDraft,
    error,
    isPending,
    inputRef,
    startEdit,
    cancel,
    save,
    handleKeyDown,
    handleBlur,
  };
}
