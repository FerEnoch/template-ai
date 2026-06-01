"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  Loader2,
  FileText,
  Database,
  Shield,
  Gavel,
  CheckCircle2,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { WizardLayout } from "@/components/wizard";
import { useWizard, stepUrl } from "@/lib/wizard";
import { WizardStep } from "@/lib/wizard";
import { saveDraft } from "@/lib/wizard";
import type { AnalysisResult, Entity } from "@template-ai/contracts";

const POLLING_INTERVAL_MS = 800;
const MAX_POLLING_ATTEMPTS = 60;
const MAX_POLLING_TIME_MS = 55_000;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={null}>
      <AnalysisContent />
    </Suspense>
  );
}

function AnalysisContent() {
  const { state, setStep, nextStep, setAnalysisResult: setWizardAnalysisResult, fileRef } = useWizard();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pollingAttempts, setPollingAttempts] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const pollingCleanupRef = useRef<(() => void) | null>(null);

  // Guard: redirect if no file
  useEffect(() => {
    const stepParam = searchParams.get("step");
    if (!stepParam) {
      setStep(WizardStep.ANALYSIS);
    }
    if (!state.file) {
      router.replace(stepUrl(WizardStep.UPLOAD));
      return;
    }
  }, [searchParams, state.file, router, setStep]);

  // Start analysis when page mounts with file
  useEffect(() => {
    if (!state.file || isUploading || analysisResult) return;

    let cancelled = false;
    setIsUploading(true);

    const startAnalysis = async () => {
      try {
        // Step 1: Upload file — build FormData with the actual file from the dropzone
        const fileObject = fileRef.current;
        if (!fileObject) {
          setError("Archivo no encontrado. Volvé a subirlo.");
          setIsUploading(false);
          return;
        }

        const formData = new FormData();
        formData.append("file", fileObject);

        const uploadResponse = await fetch("/api/documents/upload", {
          method: "POST",
          body: formData,
        });

        if (cancelled) return;

        if (!uploadResponse.ok) {
          setError("Error al subir el archivo");
          setIsUploading(false);
          return;
        }

        const document = await uploadResponse.json();

        if (cancelled) return;

        // Step 2: Poll GET /:id to drive the backend pipeline.
        // Each call increments progress by 25; the 4th call triggers the AI phase.
        // The backend's atomic guard prevents duplicate AI calls from concurrent polls.
        pollingCleanupRef.current = pollForAnalysis(document.id);
      } catch {
        if (!cancelled) setError("Error de conexión");
        setIsUploading(false);
      }
    };

    startAnalysis();

    return () => {
      cancelled = true;
      if (pollingCleanupRef.current) {
        pollingCleanupRef.current();
        pollingCleanupRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.file]);

  const pollForAnalysis = useCallback(
    (documentId: string) => {
      let attempt = 0;
      const startedAt = Date.now();
      const isStaleRef = { current: false }; // race condition guard — prevents stale callbacks from mutating state
      let progressTriggerActive = false;      // prevents concurrent /:id calls

      // Helper: call GET /:id to advance progress (outside the polling loop).
      // Each call increments progress by 25 in the backend Phase 1.
      // If the call completes the analysis (returns terminal status), handles it immediately.
      const triggerProgress = async () => {
        if (progressTriggerActive || isStaleRef.current) return;
        progressTriggerActive = true;
        try {
          const response = await fetch(`/api/analysis/${documentId}`);
          if (!response.ok || isStaleRef.current) return;
          const result: AnalysisResult = await response.json();
          if (isStaleRef.current) return;

          // If this call completed the analysis (status is terminal), handle immediately
          if (result.status === "completed") {
            isStaleRef.current = true;
            clearInterval(interval);
            setAnalysisResult(result);
            setWarning(null);
            setWizardAnalysisResult(documentId, result.entities);
            saveDraft(state.file!, documentId, result.entities);
            setIsUploading(false);
            return;
          }
          if (result.status === "failed") {
            isStaleRef.current = true;
            clearInterval(interval);
            setAnalysisResult(result);
            setError("El análisis falló. Intentá de nuevo.");
            setIsUploading(false);
            return;
          }
          // Otherwise: progress was incremented, keep polling
        } catch {
          // Network error during trigger — will retry on next poll cycle
        } finally {
          progressTriggerActive = false;
        }
      };

      // Main polling loop: monitors status via lightweight GET /:id/status endpoint.
      // Read-only, fast (<30ms), no DB mutations — no log spam.
      const interval = setInterval(async () => {
        if (isStaleRef.current) return; // guard: cleared or unmounted
        attempt++;

        try {
          const response = await fetch(`/api/analysis/${documentId}/status`);
          if (!response.ok) {
            isStaleRef.current = true;
            clearInterval(interval);
            setError(`Error del servidor (${response.status})`);
            setIsUploading(false);
            return;
          }

          const statusData: { documentId: string; status: string; progress: number } =
            await response.json();

          if (isStaleRef.current) return; // re-check after await

          if (statusData.status === "completed") {
            clearInterval(interval);
            // Fetch full result ONCE with entities and extractedText
            const fullResponse = await fetch(`/api/analysis/${documentId}`);
            if (!fullResponse.ok) {
              if (!isStaleRef.current) {
                setError(`Error al obtener el resultado (${fullResponse.status})`);
                setIsUploading(false);
              }
              return;
            }
            const fullResult: AnalysisResult = await fullResponse.json();
            if (!isStaleRef.current) {
              setAnalysisResult(fullResult);
              setWarning(null);
              setWizardAnalysisResult(documentId, fullResult.entities);
              saveDraft(state.file!, documentId, fullResult.entities);
              setIsUploading(false);
            }
          } else if (statusData.status === "failed") {
            clearInterval(interval);
            // Build minimal AnalysisResult for failed state transition
            const failedResult: AnalysisResult = {
              documentId,
              status: "failed",
              progress: statusData.progress,
              entities: [],
              extractedText: null,
            } as AnalysisResult;
            if (!isStaleRef.current) {
              setAnalysisResult(failedResult); // ← B5 fix: update state so isProcessing becomes false
              setError("El análisis falló. Intentá de nuevo.");
              setIsUploading(false);
            }
          } else {
            // Still processing — check timeouts and trigger progress if needed
            const elapsed = Date.now() - startedAt;
            if (elapsed > MAX_POLLING_TIME_MS) {
              setWarning("El análisis está tardando más de lo esperado. Seguimos intentando...");
            }
            if (attempt >= MAX_POLLING_ATTEMPTS) {
              isStaleRef.current = true;
              clearInterval(interval);
              setError("El análisis está tardando demasiado. Intentá de nuevo.");
              setIsUploading(false);
              return;
            }

            // Update progress bar with status data
            if (!isStaleRef.current) {
              setAnalysisResult((prev) =>
                prev
                  ? { ...prev, status: statusData.status as AnalysisResult["status"], progress: statusData.progress }
                  : ({
                      documentId,
                      status: statusData.status,
                      progress: statusData.progress,
                      entities: [],
                      extractedText: null,
                    } as AnalysisResult),
              );
              setPollingAttempts(attempt);
            }

            // Advance the backend pipeline by calling /:id if progress < 100
            if (statusData.status === "processing" && statusData.progress < 100) {
              triggerProgress();
            }
          }
        } catch {
          if (!isStaleRef.current) {
            isStaleRef.current = true;
            clearInterval(interval);
            setError("Error de conexión");
            setIsUploading(false);
          }
        }
      }, POLLING_INTERVAL_MS);

      // Fire initial progress trigger immediately (without waiting for first poll)
      triggerProgress();

      // Cleanup: mark stale → prevents in-flight callbacks from mutating state after unmount
      return () => {
        isStaleRef.current = true;
        clearInterval(interval);
      };
    },
    [state.file, setWizardAnalysisResult],
  );

  const renderHighlightedText = useCallback(
    (text: string, entities: Entity[]): React.ReactNode => {
      const sorted = entities
        .filter((e) => e.sourceSpan)
        .sort((a, b) => (a.sourceSpan!.start - b.sourceSpan!.start));

      if (sorted.length === 0) {
        return <span>{text}</span>;
      }

      const segments: React.ReactNode[] = [];
      let lastEnd = 0;

      for (const entity of sorted) {
        const span = entity.sourceSpan!;
        if (span.start > lastEnd) {
          segments.push(
            <span key={`text-${lastEnd}`}>{text.slice(lastEnd, span.start)}</span>,
          );
        }
        const colorClass =
          entity.confidence === "ALTA"
            ? "bg-success/20 border-b-2 border-success/50"
            : "bg-warning/20 border-b-2 border-warning/50";
        segments.push(
          <mark
            key={entity.id}
            className={`rounded px-0.5 ${colorClass} cursor-help`}
            title={`${entity.label}: ${entity.value}`}
          >
            {text.slice(span.start, span.end)}
          </mark>,
        );
        lastEnd = span.end;
      }
      if (lastEnd < text.length) {
        segments.push(<span key={`text-${lastEnd}`}>{text.slice(lastEnd)}</span>);
      }
      return <>{segments}</>;
    },
    [],
  );

  const handleContinue = useCallback(() => {
    if (analysisResult?.status === "completed") {
      nextStep();
    }
  }, [analysisResult, nextStep]);

  const progress = analysisResult?.progress ?? 0;
  const status = analysisResult?.status ?? "processing";
  const isCompleted = status === "completed";
  const isProcessing = status === "processing" || status === "analyzing";

  const altaCount = analysisResult?.entities.filter((e) => e.confidence === "ALTA").length ?? 0;
  const bajaCount = analysisResult?.entities.filter((e) => e.confidence === "BAJA").length ?? 0;

  return (
    <AppShell footer={false} activeSidebarItem="Nuevo Documento">
      <WizardLayout>
        <div className="mx-auto w-full max-w-7xl p-8">
          {/* Header */}
          <header className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="mb-2 font-headline text-3xl font-bold text-text-primary">
                {isCompleted ? "Análisis completado" : "Analizando tu contrato"}
              </h1>
              <p className="font-body text-text-secondary">
                {isCompleted
                  ? "El documento fue procesado exitosamente. Revisá los resultados."
                  : "Estamos procesando el documento para identificar cláusulas, entidades y riesgos potenciales."}
              </p>
            </div>
            <div className="flex shrink-0 gap-3">
              <button
                onClick={() => router.push(stepUrl(WizardStep.UPLOAD))}
                className="rounded border border-border px-5 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-background"
              >
                Cancelar Análisis
              </button>
              <button
                onClick={handleContinue}
                disabled={!isCompleted}
                className={`rounded px-5 py-2 text-sm font-semibold transition-all ${
                  isCompleted
                    ? "border border-accent bg-accent text-white hover:bg-accent-hover"
                    : "cursor-not-allowed border border-border bg-surface text-text-disabled"
                }`}
              >
                Continuar a Revisión
              </button>
            </div>
          </header>

          <div className="grid grid-cols-12 gap-8">
            {/* LEFT COLUMN: Stepper */}
            <section className="col-span-12 self-start rounded-xl border border-border bg-surface p-6 shadow-sm lg:col-span-3">
              <h3 className="mb-6 text-[10px] font-bold uppercase tracking-widest text-text-disabled">
                Estado del proceso
              </h3>
              <div className="relative flex flex-col gap-8">
                <div className="absolute bottom-2 left-3.5 top-2 w-px bg-border" />

                {/* Step 1 */}
                <div className="relative z-10 flex items-start gap-4">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      isCompleted || isProcessing
                        ? "border-green-200 bg-green-50"
                        : "border-border bg-background"
                    }`}
                  >
                    {isCompleted || isProcessing ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-text-disabled" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      Validando archivo
                    </p>
                    <p
                      className={`text-xs ${
                        isCompleted || isProcessing ? "text-success" : "text-text-disabled"
                      }`}
                    >
                      {isCompleted || isProcessing ? "Completado" : "Pendiente"}
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="relative z-10 flex items-start gap-4">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      isCompleted
                        ? "border-green-200 bg-green-50"
                        : isProcessing
                        ? "border-blue-200 bg-blue-50"
                        : "border-border bg-background"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-text-disabled" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      Extrayendo texto
                    </p>
                    <p
                      className={`text-xs ${
                        isCompleted
                          ? "text-success"
                          : isProcessing
                          ? "text-accent font-medium italic"
                          : "text-text-disabled"
                      }`}
                    >
                      {isCompleted ? "Completado" : isProcessing ? "En proceso..." : "Pendiente"}
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="relative z-10 flex items-start gap-4">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      isCompleted
                        ? "border-green-200 bg-green-50"
                        : "border-border bg-background"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-text-disabled" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      Detectando estructura
                    </p>
                    <p
                      className={`text-xs ${
                        isCompleted ? "text-success" : "text-text-disabled"
                      }`}
                    >
                      {isCompleted ? "Completado" : "Pendiente"}
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="relative z-10 flex items-start gap-4">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      isCompleted
                        ? "border-green-200 bg-green-50"
                        : "border-border bg-background"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <div className="h-1.5 w-1.5 rounded-full bg-text-disabled" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      Identificando datos del caso
                    </p>
                    <p
                      className={`text-xs ${
                        isCompleted ? "text-success" : "text-text-disabled"
                      }`}
                    >
                      {isCompleted ? "Completado" : "Pendiente"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              {isProcessing && (
                <div className="mt-6">
                  <div className="mb-1 flex justify-between text-xs text-text-secondary">
                    <span>Progreso</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Confidence card */}
              {isCompleted && analysisResult && (
                <div className="mt-10 rounded-lg border border-border bg-background p-4">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                    Nivel de Confianza
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-text-secondary">
                        ALTA: {altaCount} campos
                      </span>
                      <div className="h-1.5 w-16 rounded-full bg-success/20">
                        <div
                          className="h-full rounded-full bg-success"
                          style={{
                            width: `${Math.round((altaCount / (analysisResult.entities.length || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                    {bajaCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-secondary">
                          BAJA: {bajaCount} campos
                        </span>
                        <div className="h-1.5 w-16 rounded-full bg-warning/20">
                          <div
                            className="h-full rounded-full bg-warning"
                            style={{
                              width: `${Math.round((bajaCount / (analysisResult.entities.length || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* RIGHT COLUMN: Previews */}
            <section className="col-span-12 grid gap-6 lg:col-span-9 lg:grid-cols-2">
              {/* Document preview */}
              <div className="flex min-h-[500px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                <div className="flex items-center gap-2 border-b border-border bg-background p-4">
                  <FileText className="h-4 w-4 text-text-disabled" />
                  <span className="text-[10px] font-bold uppercase tracking-tight text-text-secondary">
                    Vista previa del documento
                  </span>
                </div>
                <div className="flex-grow space-y-6 p-8">
                  {isProcessing ? (
                    <>
                      <div className="h-8 w-3/4 animate-pulse rounded bg-border" />
                      <div className="space-y-3">
                        <div className="h-4 w-full animate-pulse rounded bg-border/50" />
                        <div className="h-4 w-full animate-pulse rounded bg-border/50" />
                        <div className="h-4 w-5/6 animate-pulse rounded bg-border/50" />
                        <div className="h-4 w-full animate-pulse rounded bg-border/50" />
                      </div>
                      <div className="h-48 w-full animate-pulse rounded-lg border border-dashed border-border bg-border/30" />
                      <div className="space-y-3">
                        <div className="h-4 w-full animate-pulse rounded bg-border/50" />
                        <div className="h-4 w-4/6 animate-pulse rounded bg-border/50" />
                      </div>
                    </>
                  ) : isCompleted && analysisResult ? (
                    analysisResult.extractedText ? (
                      <div className="space-y-4">
                        <div className="prose prose-sm max-w-none whitespace-pre-wrap font-body text-sm leading-relaxed text-text-primary">
                          {renderHighlightedText(
                            analysisResult.extractedText,
                            analysisResult.entities,
                          )}
                        </div>
                        {state.file && (
                          <div className="rounded-lg border border-border bg-background p-4">
                            <p className="text-xs font-medium text-text-primary">
                              {state.file.name}
                            </p>
                            <p className="text-xs text-text-secondary">
                              {formatBytes(state.file.size)}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-3 py-12">
                        <FileText className="h-8 w-8 text-text-disabled" />
                        <p className="text-sm text-text-secondary">
                          Vista previa no disponible para este documento
                        </p>
                        {state.file && (
                          <div className="mt-2 rounded-lg border border-border bg-background p-4">
                            <p className="text-xs font-medium text-text-primary">
                              {state.file.name}
                            </p>
                            <p className="text-xs text-text-secondary">
                              {formatBytes(state.file.size)}
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  ) : (
                    <>
                      <div className="h-8 w-3/4 rounded bg-border/30" />
                      <div className="space-y-3">
                        <div className="h-4 w-full rounded bg-border/30" />
                        <div className="h-4 w-full rounded bg-border/30" />
                        <div className="h-4 w-5/6 rounded bg-border/30" />
                        <div className="h-4 w-full rounded bg-border/30" />
                      </div>
                      <div className="h-48 w-full rounded-lg border border-dashed border-border bg-border/20" />
                      <div className="space-y-3">
                        <div className="h-4 w-full rounded bg-border/30" />
                        <div className="h-4 w-4/6 rounded bg-border/30" />
                      </div>
                      {state.file && (
                        <div className="mt-4 rounded-lg border border-border bg-background p-4">
                          <p className="text-xs font-medium text-text-primary">
                            {state.file.name}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {formatBytes(state.file.size)}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Entity detection */}
              <div className="flex min-h-[500px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                <div className="flex items-center gap-2 border-b border-border bg-background p-4">
                  <Database className="h-4 w-4 text-text-disabled" />
                  <span className="text-[10px] font-bold uppercase tracking-tight text-text-secondary">
                    Extracción de datos
                  </span>
                </div>
                <div className="flex-grow space-y-8 p-6">
                  {isProcessing ? (
                    <>
                      <div className="space-y-3">
                        <div className="h-3 w-20 animate-pulse rounded bg-border" />
                        <div className="flex h-10 items-center rounded border border-border bg-background px-4">
                          <div className="h-4 w-32 animate-pulse rounded bg-border" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="h-3 w-24 animate-pulse rounded bg-border" />
                        <div className="flex h-10 items-center rounded border border-border bg-background px-4">
                          <div className="h-4 w-48 animate-pulse rounded bg-border" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="h-3 w-16 animate-pulse rounded bg-border" />
                        <div className="h-24 rounded border border-border bg-background p-4">
                          <div className="mb-2 h-3 w-full animate-pulse rounded bg-border" />
                          <div className="mb-2 h-3 w-5/6 animate-pulse rounded bg-border" />
                          <div className="h-3 w-4/6 animate-pulse rounded bg-border" />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="h-3 w-32 animate-pulse rounded bg-border" />
                        <div className="flex h-10 items-center rounded border border-border bg-background px-4">
                          <div className="h-4 w-16 animate-pulse rounded bg-border" />
                        </div>
                      </div>
                    </>
                  ) : isCompleted && analysisResult ? (
                    <>
                      {analysisResult.entities.slice(0, 6).map((entity) => (
                        <div key={entity.id} className="space-y-1">
                          <div className="h-3 w-16 rounded bg-border/30" />
                          <div className="flex items-center justify-between rounded border border-border bg-background px-4 py-2">
                            <span className="text-xs font-medium text-text-secondary">
                              {entity.label}
                            </span>
                            <span className="text-sm font-bold text-text-primary">
                              {entity.value.length > 20
                                ? entity.value.slice(0, 20) + "..."
                                : entity.value}
                            </span>
                          </div>
                        </div>
                      ))}
                      {analysisResult.entities.length > 6 && (
                        <p className="text-xs text-text-secondary">
                          + {analysisResult.entities.length - 6} campos más
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                      <CheckCircle2 className="h-8 w-8 text-success" />
                      <p className="text-sm text-text-secondary">
                        Esperando análisis...
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Page footer */}
          <footer className="mt-12 flex flex-col items-center gap-4 border-t border-border pt-8">
            {error ? (
              <p className="text-sm font-medium text-danger">{error}</p>
            ) : warning ? (
              <p className="text-sm font-medium text-warning">{warning}</p>
            ) : (
              <p className="max-w-lg text-center font-body text-sm italic text-text-secondary">
                &ldquo;Si algo no se puede analizar con claridad, te lo decimos
                antes de continuar.&rdquo;
              </p>
            )}
            <div className="flex gap-4 opacity-50 grayscale">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Encriptación AES-256
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Gavel className="h-4 w-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Cumplimiento Legal AI
                </span>
              </div>
            </div>
          </footer>
        </div>
      </WizardLayout>
    </AppShell>
  );
}