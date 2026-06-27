"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

interface ConfirmDeleteDialogProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
  readonly isLoading: boolean;
  readonly templateName: string;
}

export function ConfirmDeleteDialog({
  isOpen,
  onClose,
  onConfirm,
  isLoading,
  templateName,
}: ConfirmDeleteDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

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

  return (
    <dialog
      ref={dialogRef}
      className="max-w-md w-full rounded-xl border border-border bg-surface p-0 shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === dialogRef.current) {
          onClose();
        }
      }}
    >
      <div className="p-6">
        <h2 className="font-headline text-lg font-bold text-text-primary">
          ¿Eliminar plantilla?
        </h2>
        <p className="mt-2 font-body text-sm text-text-secondary">
          Estás por eliminar &quot;{templateName}&quot;. Esta acción no se puede
          deshacer. La plantilla se archivará y podrá ser recuperada dentro de
          los próximos 30 días.
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-border bg-surface px-5 py-2 font-label text-xs font-bold text-text-secondary transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-danger px-5 py-2 font-label text-xs font-bold text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Eliminar
          </button>
        </div>
      </div>
    </dialog>
  );
}
