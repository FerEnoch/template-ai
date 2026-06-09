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
import { renderHighlightedText, useWizard, stepUrl } from "@/lib/wizard";
import { WizardStep } from "@/lib/wizard";
import { saveDraft } from "@/lib/wizard";
import { AnalysisProgress, MESSAGES } from "@/components/analysis/AnalysisProgress";
import { NotProcessableScreen } from "@/components/analysis/NotProcessableScreen";
import type { AnalysisProgressProps } from "@/components/analysis/AnalysisProgress";
import type { AnalysisResult } from "@template-ai/contracts";

const POLLING_INTERVAL_MS = 800;
const MAX_POLLING_ATTEMPTS = 60;
const MAX_POLLING_TIME_MS = 55_000;
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_FETCH_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 400;
const RETRY_MAX_DELAY_MS = 4_000;
const MAX_CONSECUTIVE_TRANSIENT_ERRORS = 5;
const CONNECTION_WARNING_MESSAGE = "La conexión está inestable. Reintentando automáticamente...";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function getNestedErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;

  const maybeCode = (error as { code?: unknown }).code;
  if (typeof maybeCode === "string") return maybeCode;

  const maybeCause = (error as { cause?: unknown }).cause;
  if (!maybeCause || typeof maybeCause !== "object") return undefined;

  const nestedCode = (maybeCause as { code?: unknown }).code;
  return typeof nestedCode === "string" ? nestedCode : undefined;
}

function isTransientNetworkError(error: unknown): boolean {
  if (isAbortError(error)) return true;

  const code = getNestedErrorCode(error)?.toUpperCase();
  if (code && ["ECONNRESET", "ETIMEDOUT", "EPIPE", "UND_ERR_SOCKET"].includes(code)) {
    return true;
  }

  const message =
    typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "").toLowerCase()
      : "";

  return [
    "failed to fetch",
    "fetch failed",
    "networkerror",
    "network error",
    "socket hang up",
    "econnreset",
    "timeout",
    "connection",
  ].some((fragment) => message.includes(fragment));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: {
    staleRef?: { current: boolean };
    retries?: number;
    timeoutMs?: number;
  },
): Promise<Response> {
  const staleRef = options?.staleRef;
  const retries = options?.retries ?? MAX_FETCH_RETRIES;
  const timeoutMs = options?.timeoutMs ?? REQUEST_TIMEOUT_MS;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (staleRef?.current) {
      throw lastError ?? new DOMException("Request aborted", "AbortError");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response;
    } catch (error) {
      clearTimeout(timeout);
      lastError = error;

      const isLastAttempt = attempt >= retries;
      const shouldRetry = isTransientNetworkError(error) && !isLastAttempt && !staleRef?.current;

      if (!shouldRetry) {
        throw error;
      }

      const delay = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
      await wait(delay);
    }
  }

  throw lastError ?? new Error("Unknown fetch error");
}

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
  const [uploadErrorType, setUploadErrorType] = useState<"not-processable" | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [analyzingElapsed, setAnalyzingElapsed] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const pollingCleanupRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmountedRef = useRef(false);
  const activeControllersRef = useRef<Set<AbortController>>(new Set());

  const abortInFlightRequests = useCallback(() => {
    activeControllersRef.current.forEach((controller) => {
      controller.abort();
    });
    activeControllersRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      abortInFlightRequests();
    };
  }, [abortInFlightRequests]);

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

  // Restore analysis result from wizard state when navigating back to this page
  // after a completed analysis (prevents re-triggering + dead buttons).
  useEffect(() => {
    if (state.entities.length > 0 && state.analysisResultId && !analysisResult) {
      setAnalysisResult({
        documentId: state.analysisResultId,
        status: "completed",
        progress: 100,
        entities: state.entities,
        extractedText: state.extractedText,
      } as AnalysisResult);
      setIsUploading(false);
    }
  }, [state.entities, state.analysisResultId, state.extractedText, analysisResult]);

  // Start analysis when page mounts with file.
  // Guard prevents re-triggering when:
  // - No file in wizard state
  // - Already uploading
  // - Analysis already completed (local state)
  // - Analysis was already done in a previous visit (wizard state has entities)
  useEffect(() => {
    const hasPreviousAnalysis = state.entities.length > 0 && state.analysisResultId;
    if (!state.file || isUploading || analysisResult || hasPreviousAnalysis) return;

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

        const uploadResponse = await fetchWithRetry(
          "/api/documents/upload",
          {
            method: "POST",
            body: formData,
          },
          {
            retries: MAX_FETCH_RETRIES,
          },
        );

        if (cancelled) return;

        if (!uploadResponse.ok) {
          // Discriminate: 4xx client errors → file not processable (show dedicated screen)
          // 5xx server errors → generic error message
          if (
            uploadResponse.status === 400 ||
            uploadResponse.status === 415 ||
            uploadResponse.status === 422
          ) {
            // Read error body for potential future use (e.g., logging)
            try {
              const errorBody = await uploadResponse.json();
              void errorBody; // captured for debugging; screen shows fixed messaging
            } catch {
              // Body may not be JSON — ignore
            }
            setUploadErrorType("not-processable");
          } else {
            setError("Error al subir el archivo");
          }
          setIsUploading(false);
          return;
        }

        const document = await uploadResponse.json();

        if (cancelled) return;

        // Step 2: Poll GET /:id to drive the backend pipeline.
        // Each call increments progress by 25; the 4th call triggers the AI phase.
        // The backend's atomic guard prevents duplicate AI calls from concurrent polls.
        pollingCleanupRef.current = pollForAnalysis(document.id);
      } catch (fetchError) {
        if (!cancelled && !isAbortError(fetchError)) setError("Error de conexión al iniciar el análisis. ¿Está corriendo el backend?");
        setIsUploading(false);
      }
    };

    startAnalysis();

    return () => {
      cancelled = true;
      abortInFlightRequests();
      if (pollingCleanupRef.current) {
        pollingCleanupRef.current();
        pollingCleanupRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.file, retryToken]);

  // Timer + rotating messages management
  useEffect(() => {
    const status = analysisResult?.status;
    const isAnalyzing = status === "analyzing";

    if (!isAnalyzing) {
      setAnalyzingElapsed(0);
      setMessageIndex(0);
      return;
    }

    // Start 1s timer
    timerRef.current = setInterval(() => {
      setAnalyzingElapsed((prev) => prev + 1);
    }, 1000);

    // Start 6s message rotation (start from 1 because message 0 shows on first render)
    let idx = 1;
    msgRef.current = setInterval(() => {
      setMessageIndex(idx % MESSAGES.length);
      idx++;
    }, 6000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (msgRef.current) {
        clearInterval(msgRef.current);
        msgRef.current = null;
      }
    };
  }, [analysisResult?.status]);

  const pollForAnalysis = useCallback(
    (documentId: string) => {
      let attempt = 0;
      const startedAt = Date.now();
      const isStaleRef = { current: false }; // race condition guard — prevents stale callbacks from mutating state
      let progressTriggerActive = false;      // prevents concurrent /:id calls
      let statusRequestActive = false;
      let consecutiveTransientErrors = 0;

      // Helper: call GET /:id to advance progress (outside the polling loop).
      // Each call increments progress by 25 in the backend Phase 1.
      // If the call completes the analysis (returns terminal status), handles it immediately.
      const triggerProgress = async () => {
        if (progressTriggerActive || isStaleRef.current) return;
        progressTriggerActive = true;
        try {
          const response = await fetchWithRetry(
            `/api/analysis/${documentId}`,
            {},
            { staleRef: isStaleRef },
          );
          if (!response.ok || isStaleRef.current) return;
          const result: AnalysisResult = await response.json();
          if (isStaleRef.current) return;

          // If this call completed the analysis (status is terminal), handle immediately
          if (result.status === "completed") {
            isStaleRef.current = true;
            clearInterval(interval);
            setAnalysisResult(result);
            setWarning(null);
            setWizardAnalysisResult(documentId, result.entities, result.extractedText);
            saveDraft({
              file: state.file!,
              analysisResultId: documentId,
              entities: result.entities,
              extractedText: result.extractedText,
            });
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
        } catch (triggerError) {
          if (!isStaleRef.current && isTransientNetworkError(triggerError)) {
            setWarning(CONNECTION_WARNING_MESSAGE);
          }
        } finally {
          progressTriggerActive = false;
        }
      };

      // Main polling loop: monitors status via lightweight GET /:id/status endpoint.
      // Read-only, fast (<30ms), no DB mutations — no log spam.
      const interval = setInterval(async () => {
        if (isStaleRef.current || statusRequestActive) return; // guard: cleared, unmounted, or overlap
        statusRequestActive = true;
        attempt++;

        try {
          const response = await fetchWithRetry(
            `/api/analysis/${documentId}/status`,
            {},
            { staleRef: isStaleRef },
          );

          consecutiveTransientErrors = 0;
          setWarning(null);

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
            const fullResponse = await fetchWithRetry(
              `/api/analysis/${documentId}`,
              {},
              { staleRef: isStaleRef },
            );
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
              setWizardAnalysisResult(documentId, fullResult.entities, fullResult.extractedText);
              saveDraft({
                file: state.file!,
                analysisResultId: documentId,
                entities: fullResult.entities,
                extractedText: fullResult.extractedText,
              });
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
        } catch (statusError) {
          if (isStaleRef.current || isAbortError(statusError)) return;

          if (isTransientNetworkError(statusError)) {
            consecutiveTransientErrors += 1;
            if (consecutiveTransientErrors < MAX_CONSECUTIVE_TRANSIENT_ERRORS) {
              setWarning(CONNECTION_WARNING_MESSAGE);
            }
            return;
          }

          // Non-transient polling failure — but the worker may have finished
          // in the background. Retry with backoff before giving up.
          try {
            const finalCheck = await fetchWithRetry(
              `/api/analysis/${documentId}/status`,
              {},
              { staleRef: isStaleRef, retries: 3, timeoutMs: REQUEST_TIMEOUT_MS },
            );
            if (finalCheck.ok) {
              const finalStatus = await finalCheck.json();
              if (finalStatus.status === "completed") {
                const fullResponse = await fetchWithRetry(
                  `/api/analysis/${documentId}`,
                  {},
                  { staleRef: isStaleRef, retries: 2, timeoutMs: REQUEST_TIMEOUT_MS },
                );
                if (fullResponse.ok) {
                  const fullResult: AnalysisResult = await fullResponse.json();
                  if (!isStaleRef.current) {
                    setAnalysisResult(fullResult);
                    setWarning(null);
                    setWizardAnalysisResult(documentId, fullResult.entities, fullResult.extractedText ?? null);
                    saveDraft({
                      file: state.file!,
                      analysisResultId: documentId,
                      entities: fullResult.entities,
                      extractedText: fullResult.extractedText,
                    });
                    setIsUploading(false);
                    clearInterval(interval);
                  }
                  return;
                }
              }
            }
          } catch (_) {
            // Final check failed too — fall through to error
          }

          isStaleRef.current = true;
          clearInterval(interval);
          setError("Error de conexión durante el análisis. El worker puede haber completado — revisá el documento en la biblioteca.");
          setIsUploading(false);
        } finally {
          statusRequestActive = false;
        }
      }, POLLING_INTERVAL_MS);

      // Fire initial progress trigger immediately (without waiting for first poll)
      triggerProgress();

      // Cleanup: mark stale → prevents in-flight callbacks from mutating state after unmount
      return () => {
        isStaleRef.current = true;
        clearInterval(interval);
        abortInFlightRequests();
      };
    },
    [state.file, setWizardAnalysisResult, abortInFlightRequests, fetchWithRetry],
  );

  const handleContinue = useCallback(() => {
    const hasWizardResult = state.entities.length > 0 && state.analysisResultId;
    if (analysisResult?.status === "completed" || hasWizardResult) {
      nextStep();
    }
  }, [analysisResult, nextStep, state.entities.length, state.analysisResultId]);

  // Derive display state from local state first, fall back to wizard state
  // so buttons work immediately after navigating back (before restore effect fires).
  const hasWizardResult = state.entities.length > 0 && state.analysisResultId;
  const progress = analysisResult?.progress ?? (hasWizardResult ? 100 : 0);
  const status = analysisResult?.status ?? (hasWizardResult ? "completed" : "processing");
  const isCompleted = status === "completed";
  const isProcessing = status === "processing";
  const isAnalyzing = status === "analyzing";
  const showWaitingUI = isProcessing || isAnalyzing;
  const displayEntities = analysisResult?.entities ?? (hasWizardResult ? state.entities : []);
  const displayExtractedText = analysisResult?.extractedText ?? (hasWizardResult ? state.extractedText : null);

  const altaCount = displayEntities.filter((e) => e.confidence === "ALTA").length;
  const bajaCount = displayEntities.filter((e) => e.confidence === "BAJA").length;

  // ── Not-processable error screen (HTTP 400/415/422) ──
  if (uploadErrorType === "not-processable") {
    return (
      <AppShell footer={false} activeSidebarItem="Nuevo Documento">
        <NotProcessableScreen
          file={{ name: state.file?.name ?? "" }}
          onRetry={() => {
            setUploadErrorType(null);
            setError(null);
            setAnalysisResult(null);
            setPollingAttempts(0);
            setRetryToken((t) => t + 1);
          }}
          onGoBack={() => {
            router.push(stepUrl(WizardStep.UPLOAD));
          }}
          onGoHome={() => {
            router.push("/");
          }}
        />
      </AppShell>
    );
  }

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
                      isCompleted || showWaitingUI
                        ? "border-green-200 bg-green-50"
                        : "border-border bg-background"
                    }`}
                  >
                    {isCompleted || showWaitingUI ? (
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
                        isCompleted || showWaitingUI ? "text-success" : "text-text-disabled"
                      }`}
                    >
                      {isCompleted || showWaitingUI ? "Completado" : "Pendiente"}
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="relative z-10 flex items-start gap-4">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      isCompleted
                        ? "border-green-200 bg-green-50"
                        : showWaitingUI
                        ? "border-blue-200 bg-blue-50"
                        : "border-border bg-background"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : showWaitingUI ? (
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
                          : showWaitingUI
                          ? "text-accent font-medium italic"
                          : "text-text-disabled"
                      }`}
                    >
                      {isCompleted ? "Completado" : showWaitingUI ? "En proceso..." : "Pendiente"}
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="relative z-10 flex items-start gap-4">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      isCompleted
                        ? "border-green-200 bg-green-50"
                        : isAnalyzing
                        ? "border-blue-200 bg-blue-50"
                        : "border-border bg-background"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : isAnalyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
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
                        isCompleted
                          ? "text-success"
                          : isAnalyzing
                          ? "text-accent font-medium italic"
                          : "text-text-disabled"
                      }`}
                    >
                      {isCompleted ? "Completado" : isAnalyzing ? "En proceso..." : "Pendiente"}
                    </p>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="relative z-10 flex items-start gap-4">
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
                      isCompleted
                        ? "border-green-200 bg-green-50"
                        : isAnalyzing
                        ? "border-blue-200 bg-blue-50"
                        : "border-border bg-background"
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : isAnalyzing ? (
                      <Loader2 className="h-4 w-4 animate-spin text-accent" />
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
                        isCompleted
                          ? "text-success"
                          : isAnalyzing
                          ? "text-accent font-medium italic"
                          : "text-text-disabled"
                      }`}
                    >
                      {isCompleted ? "Completado" : isAnalyzing ? "En proceso..." : "Pendiente"}
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
              {isCompleted && (
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
                            width: `${Math.round((altaCount / (displayEntities.length || 1)) * 100)}%`,
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
                              width: `${Math.round((bajaCount / (displayEntities.length || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>

            {isCompleted ? (
              <section className="col-span-12 lg:col-span-9">
                <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 rounded-xl border border-border bg-surface p-10 text-center shadow-sm">
                  <CheckCircle2 className="h-12 w-12 text-success" />
                  <div className="space-y-2">
                    <h2 className="font-headline text-2xl font-bold text-text-primary">
                      Análisis completado correctamente
                    </h2>
                    <p className="font-body text-sm text-text-secondary">
                      Revisá los datos detectados antes de guardar la plantilla.
                    </p>
                  </div>

                  {isCompleted && (
                    <div className="w-full rounded-lg border border-border bg-background p-4 text-left">
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                        Resumen de confianza
                      </p>
                      <div className="space-y-2 text-sm text-text-primary">
                        <p>ALTA: {altaCount} campos</p>
                        <p>BAJA: {bajaCount} campos</p>
                        <p>Total detectado: {displayEntities.length} campos</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={handleContinue}
                    className="w-full rounded-lg bg-accent px-8 py-4 text-base font-bold text-white transition-colors hover:bg-accent-hover"
                  >
                    Ir a Revisión
                  </button>
                </div>
              </section>
            ) : (
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
                    {showWaitingUI ? (
                      <AnalysisProgress
                        status={status as AnalysisProgressProps["status"]}
                        progress={progress}
                        fileName={state.file?.name}
                        fileSize={state.file?.size}
                        analyzingElapsed={analyzingElapsed}
                        currentMessageIndex={messageIndex}
                      />
                    ) : displayExtractedText ? (
                      <div className="prose prose-sm max-w-none whitespace-pre-wrap font-body text-sm leading-relaxed text-text-primary">
                        {renderHighlightedText(
                          displayExtractedText,
                          displayEntities,
                        )}
                      </div>
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
                    {showWaitingUI ? (
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
            )}
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
