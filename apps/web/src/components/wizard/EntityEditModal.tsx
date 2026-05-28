"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, AlertTriangle, RotateCcw } from "lucide-react";
import type { Entity } from "@template-ai/contracts";

type Confidence = "ALTA" | "BAJA";

interface EntityEditModalProps {
  entity: Entity | null;
  isOpen: boolean;
  onSave: (entity: Entity) => Promise<void> | void;
  onClose: () => void;
}

const CONFIDENCE_OPTIONS: { value: Confidence; label: string; activeClass: string }[] = [
  {
    value: "ALTA",
    label: "ALTA",
    activeClass: "border-success bg-success/10 text-success",
  },
  {
    value: "BAJA",
    label: "BAJA",
    activeClass: "border-danger bg-danger/10 text-danger",
  },
];

export function EntityEditModal({
  entity,
  isOpen,
  onSave,
  onClose,
}: EntityEditModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState("");
  const [confidence, setConfidence] = useState<Confidence>("ALTA");
  const [excluded, setExcluded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync local state when entity changes or modal opens
  useEffect(() => {
    if (entity) {
      setValue(entity.value);
      setConfidence(entity.confidence === "MEDIA" ? "ALTA" : (entity.confidence as Confidence));
      setExcluded(entity.excluded ?? false);
      setError(null);
    }
  }, [entity]);

  // Control dialog open/close via the isOpen prop
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Handle native dialog close (escape key or backdrop click)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      onClose();
    };

    dialog.addEventListener("close", handleClose);
    return () => {
      dialog.removeEventListener("close", handleClose);
    };
  }, [onClose]);

  const handleSave = useCallback(async () => {
    if (!entity) return;

    setSaving(true);
    setError(null);

    try {
      const updated: Entity = {
        ...entity,
        value,
        confidence,
        excluded,
        reviewed: true,
      };
      await onSave(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar los cambios"
      );
    } finally {
      setSaving(false);
    }
  }, [entity, value, confidence, excluded, onSave]);

  const handleToggleExcluded = useCallback(() => {
    setExcluded((prev) => !prev);
    setError(null);
  }, []);

  const handleRestore = useCallback(() => {
    setExcluded(false);
    setError(null);
  }, []);

  if (!entity) return null;

  return (
    <dialog
      ref={dialogRef}
      className="max-w-lg w-full rounded-lg border border-border bg-surface p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="p-6">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="font-headline text-lg font-bold text-text-primary">
              Editar entidad
            </h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              Modificá el valor o la confianza de esta entidad detectada
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-secondary transition-colors hover:bg-background hover:text-text-primary"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Entity Label (read-only) */}
        <div className="mb-5">
          <label className="mb-1.5 block font-label text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            Etiqueta
          </label>
          <div className="rounded-md border border-border bg-background px-4 py-2.5 text-sm font-bold text-text-primary">
            {entity.label}
          </div>
        </div>

        {/* Entity Value (editable) */}
        <div className="mb-5">
          <label
            htmlFor="entity-value"
            className="mb-1.5 block font-label text-[10px] font-bold uppercase tracking-widest text-text-secondary"
          >
            Valor
          </label>
          <input
            id="entity-value"
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            className="w-full rounded-md border border-border bg-background px-4 py-2.5 text-sm font-bold text-text-primary transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Confidence Toggle */}
        <div className="mb-5">
          <label className="mb-1.5 block font-label text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            Confianza
          </label>
          <div className="flex gap-2">
            {CONFIDENCE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  setConfidence(opt.value);
                  setError(null);
                }}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-bold transition-all ${
                  confidence === opt.value
                    ? opt.activeClass
                    : "border-border bg-background text-text-secondary hover:border-text-secondary/30"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Exclude / Restore */}
        <div className="mb-5">
          {excluded ? (
            <button
              onClick={handleRestore}
              className="flex items-center gap-1.5 rounded-md border border-success/30 bg-success/5 px-3 py-2 text-xs font-bold text-success transition-colors hover:bg-success/10"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar entidad
            </button>
          ) : (
            <button
              onClick={handleToggleExcluded}
              className="flex items-center gap-1.5 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-xs font-bold text-danger transition-colors hover:bg-danger/10"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Excluir entidad
            </button>
          )}
          {excluded && (
            <p className="mt-1.5 text-[11px] italic text-text-secondary">
              Esta entidad será excluida del documento final
            </p>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-5 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-xs font-bold text-danger">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
          <button
            onClick={onClose}
            className="rounded-md border border-border px-5 py-2 text-xs font-bold text-text-secondary transition-colors hover:bg-background"
            disabled={saving}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`rounded-md px-5 py-2 text-xs font-bold transition-all ${
              saving
                ? "cursor-not-allowed bg-text-disabled/30 text-white"
                : "bg-accent text-white hover:bg-accent-hover"
            }`}
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </dialog>
  );
}