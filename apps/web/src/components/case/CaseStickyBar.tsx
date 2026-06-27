"use client";

import { CheckCircle2, Info, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface CaseStickyBarProps {
  readonly progress: number;
  readonly filled: number;
  readonly total: number;
  readonly status: "idle" | "saving" | "saved" | "generating";
  readonly error: string | null;
  readonly onSave: () => void;
  readonly onGenerate: () => void;
}

export function CaseStickyBar({
  progress,
  filled,
  total,
  status,
  error,
  onSave,
  onGenerate,
}: CaseStickyBarProps) {
  const isGenerating = status === "generating";
  const canGenerate = progress >= 80 && !isGenerating;
  const remaining = total - filled;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-6 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
        <div className="flex items-center gap-3">
          {isGenerating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              <p className="font-label text-sm font-medium text-text-secondary">
                Generando documento...
              </p>
            </>
          ) : error ? (
            <>
              <AlertCircle className="h-5 w-5 text-danger" />
              <p className="font-label text-sm font-medium text-danger">
                {error}
              </p>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-5 w-5 text-text-disabled" />
              <p className="font-label text-sm font-medium text-text-secondary">
                {status === "saving" && "Guardando borrador..."}
                {status === "saved" && "Borrador guardado"}
                {status === "idle" && `${filled} de ${total} campos completados`}
              </p>
            </>
          )}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSave}
              disabled={status === "saving" || isGenerating}
              className={cn(
                "rounded border border-border bg-surface px-6 py-2.5 font-label text-sm font-semibold text-text-secondary transition-colors hover:bg-background",
                (status === "saving" || isGenerating) && "cursor-not-allowed opacity-60"
              )}
            >
              Guardar borrador
            </button>
            <button
              type="button"
              onClick={onGenerate}
              disabled={!canGenerate}
              className={cn(
                "rounded px-6 py-2.5 font-label text-sm font-bold transition-colors",
                isGenerating
                  ? "cursor-wait bg-accent text-white"
                  : canGenerate
                    ? "bg-text-primary text-surface hover:bg-text-primary/90"
                    : "cursor-not-allowed bg-border text-text-disabled"
              )}
            >
              {isGenerating ? "Generando..." : "Generar documento"}
            </button>
          </div>

          {!canGenerate && !isGenerating && remaining > 0 && !error && (
            <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-warning">
              <Info className="h-3 w-3" />
              Completá los {remaining} campos pendientes antes de generar
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
