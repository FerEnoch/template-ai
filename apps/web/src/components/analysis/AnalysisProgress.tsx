"use client";

import { FileText, Loader2 } from "lucide-react";

// ── Types ──

export interface AnalysisProgressProps {
  status: "processing" | "analyzing" | "completed" | "failed" | "pending";
  progress: number; // 0–100, only meaningful for "processing"
  fileName?: string;
  fileSize?: number; // bytes
  analyzingElapsed?: number; // seconds, only meaningful for "analyzing"
  currentMessageIndex?: number; // 0-based
}

// ── Constants ──

export const MESSAGES = [
  "Leyendo el documento y comprendiendo su estructura...",
  "Identificando cláusulas y secciones relevantes...",
  "Extrayendo entidades: fechas, montos, partes involucradas...",
  "Verificando consistencia de la información extraída...",
  "Organizando los datos para tu revisión...",
] as const;

export const REASSURANCE_THRESHOLD_S = 30;
export const REASSURANCE_TEXT =
  "Los documentos extensos o complejos pueden tomar más tiempo. Esto es completamente normal.";

// ── Helpers ──

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Component ──

export function AnalysisProgress({
  status,
  progress,
  fileName,
  fileSize,
  analyzingElapsed = 0,
  currentMessageIndex = 0,
}: AnalysisProgressProps) {
  const isProcessing = status === "processing";
  const isAnalyzing = status === "analyzing";
  const isFailed = status === "failed";

  // Derive message safely
  const safeIndex = currentMessageIndex % MESSAGES.length;
  const currentMessage = MESSAGES[safeIndex];
  const showReassurance =
    isAnalyzing && analyzingElapsed >= REASSURANCE_THRESHOLD_S;

  // Aria-live announcement: only on meaningful phase transitions
  const ariaAnnouncement = (() => {
    if (isAnalyzing && analyzingElapsed === 0)
      return "Analizando documento con IA";
    if (status === "completed") return "Análisis completado";
    if (isFailed) return "El análisis falló";
    return null;
  })();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* ── File badge ── */}
      {fileName && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
          <FileText className="h-5 w-5 shrink-0 text-accent" />
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-semibold text-text-primary"
              data-testid="file-badge-name"
            >
              {fileName}
            </p>
            {fileSize !== undefined && (
              <p
                className="text-xs text-text-secondary"
                data-testid="file-badge-size"
              >
                {formatBytes(fileSize)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Progress bar ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-text-secondary">
            {isAnalyzing
              ? "Analizando con IA"
              : isProcessing
                ? "Procesando documento"
                : isFailed
                  ? "Análisis fallido"
                  : "Completado"}
          </span>

          {isAnalyzing && (
            <span
              className="text-xs tabular-nums text-text-secondary"
              data-testid="elapsed-timer"
              aria-label={`Tiempo transcurrido: ${analyzingElapsed} segundos`}
            >
              {formatElapsed(analyzingElapsed)}
            </span>
          )}

          {isProcessing && (
            <span className="text-xs tabular-nums text-text-secondary">
              {progress}%
            </span>
          )}
        </div>

        {/* Determinate bar (processing) */}
        {isProcessing && (
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progress}% completado`}
            className="h-2 w-full overflow-hidden rounded-full bg-border"
          >
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Indeterminate bar (analyzing) */}
        {isAnalyzing && (
          <div
            role="progressbar"
            aria-valuetext="Procesando"
            aria-label="Analizando documento"
            className="relative h-2 w-full overflow-hidden rounded-full bg-border"
          >
            <div
              className="animate-scan-line absolute inset-y-0 w-1/2 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, var(--color-accent) 50%, transparent 100%)",
              }}
            />
          </div>
        )}

        {/* Terminal bar (completed / failed) */}
        {(status === "completed" || isFailed) && (
          <div
            role="progressbar"
            aria-valuenow={isFailed ? 0 : 100}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={isFailed ? "Análisis fallido" : "Análisis completado"}
            className="h-2 w-full overflow-hidden rounded-full bg-border"
          >
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isFailed ? "bg-danger" : "bg-success"
              }`}
              style={{ width: "100%" }}
            />
          </div>
        )}
      </div>

      {/* ── Rotating message (analyzing only) ── */}
      {isAnalyzing && (
        <div className="space-y-3">
          <p
            className="animate-fade-in-up text-center font-body text-sm italic text-text-secondary"
            aria-hidden="true"
            data-testid="status-message"
          >
            {currentMessage}
          </p>

          {showReassurance && (
            <p
              className="animate-fade-in-up text-center text-xs italic text-text-secondary"
              data-testid="reassurance-message"
            >
              {REASSURANCE_TEXT}
            </p>
          )}
        </div>
      )}

      {/* ── Failed message ── */}
      {isFailed && (
        <p
          className="text-center text-sm font-medium text-danger"
          data-testid="failed-message"
        >
          El análisis falló. Intentá de nuevo.
        </p>
      )}

      {/* ── Completed message ── */}
      {status === "completed" && (
        <p className="text-center text-sm font-medium text-success">
          Análisis completado exitosamente.
        </p>
      )}

      {/* ── Pending placeholder ── */}
      {status === "pending" && (
        <div className="flex items-center justify-center gap-3 py-4">
          <Loader2 className="h-4 w-4 animate-spin text-text-disabled" />
          <span className="text-sm text-text-disabled">
            Preparando análisis...
          </span>
        </div>
      )}

      {/* ── Aria-live region ── */}
      {ariaAnnouncement && (
        <div
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
          data-testid="aria-announcement"
          role="status"
        >
          {ariaAnnouncement}
        </div>
      )}
    </div>
  );
}
