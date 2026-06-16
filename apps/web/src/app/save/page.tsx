"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  Tag,
  Calendar,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  X,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { WizardLayout, SaveForm } from "@/components/wizard";
import { useWizard, stepUrl } from "@/lib/wizard";
import { WizardStep } from "@/lib/wizard";
import { clearDraft } from "@/lib/wizard";
import type { Template } from "@template-ai/contracts";

type SaveStatus = "idle" | "submitting" | "success" | "error";

function SaveContent({
  state,
  setStep,
  reset,
  searchParams,
  router,
}: {
  state: ReturnType<typeof useWizard>["state"];
  setStep: ReturnType<typeof useWizard>["setStep"];
  reset: ReturnType<typeof useWizard>["reset"];
  searchParams: ReturnType<typeof useSearchParams>;
  router: ReturnType<typeof useRouter>;
}) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Guard: redirect if no entities
  useEffect(() => {
    const stepParam = searchParams.get("step");
    if (!stepParam) {
      setStep(WizardStep.SAVE);
    }
    if (!state.file) {
      router.replace(stepUrl(WizardStep.UPLOAD));
      return;
    }
    if (!state.analysisResultId && state.entities.length === 0) {
      router.replace(stepUrl(WizardStep.ANALYSIS));
      return;
    }
    if (state.entities.length === 0) {
      router.replace(stepUrl(WizardStep.REVIEW));
      return;
    }
  }, [searchParams, state, router, setStep]);

  const handleSubmit = useCallback(
    async (values: { name: string; description?: string; category: string }) => {
      if (!state.analysisResultId) return;

      setStatus("submitting");
      setErrorMessage(null);

      try {
        const response = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name,
            description: values.description ?? "",
            category: values.category,
            documentId: state.analysisResultId,
            entities: state.entities,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error ?? "Error al guardar la plantilla");
        }

        const template: Template = await response.json();
        setStatus("success");

        clearDraft();

        setTimeout(() => {
          reset();
          router.push("/");
        }, 3000);
      } catch (err) {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Error desconocido");
      }
    },
    [state.analysisResultId, state.entities, reset, router]
  );

  const totalEntities = state.entities.length;
  const reviewedEntities = state.entities.filter((e) => e.reviewed).length;
  const progressPercent =
    totalEntities > 0 ? Math.round((reviewedEntities / totalEntities) * 100) : 100;

  return (
    <AppShell sidebar={false}>
      <WizardLayout>
        <div className="flex flex-1 flex-col bg-background p-6 md:flex-row md:gap-8">
          <aside className="space-y-6 md:w-1/4">
            <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between">
                <span className="rounded bg-neutral/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neutral">
                  BORRADOR
                </span>
                <FileText className="text-lg text-text-disabled" />
              </div>
              <h1 className="mb-2 font-headline text-xl font-bold leading-tight text-text-primary">
                {state.templateForm?.name ?? "Nueva plantilla"}
              </h1>
              <div className="mb-6 space-y-1">
                <p className="flex items-center gap-2 font-label text-xs text-text-secondary">
                  <Tag className="h-3.5 w-3.5" />
                  {state.templateForm?.category ?? "Contratos"}
                </p>
                <p className="flex items-center gap-2 font-label text-xs text-text-secondary">
                  <Calendar className="h-3.5 w-3.5" />
                  {new Date().toLocaleDateString("es-AR")}
                </p>
              </div>
              <div className="border-t border-border pt-6">
                <div className="mb-2 flex justify-between font-label text-xs font-medium">
                  <span className="text-text-secondary">
                    Progreso: {reviewedEntities} / {totalEntities} campos
                  </span>
                  <span className="text-text-primary">{progressPercent}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-accent transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="h-48 w-full overflow-hidden rounded-lg">
                <div className="h-full w-full bg-gradient-to-br from-border/40 to-border/20 grayscale" />
              </div>
            </div>
          </aside>

          <section className="pb-36 md:w-3/4">
            <div className="mx-auto max-w-3xl space-y-8">
              <div className="flex items-center justify-between">
                <h2 className="font-headline text-3xl font-bold text-text-primary">
                  Guardar plantilla
                </h2>
                {status === "success" && (
                  <div className="flex items-center gap-2 rounded-full border border-success/10 bg-success/10 px-3 py-1.5">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-xs font-bold uppercase tracking-wider text-success">
                      GUARDADA
                    </span>
                  </div>
                )}
              </div>

              {status === "success" ? (
                <div className="rounded-xl border border-success/20 bg-success/5 p-8 text-center">
                  <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-success" />
                  <h3 className="mb-2 font-headline text-xl font-bold text-text-primary">
                    ¡Plantilla guardada!
                  </h3>
                  <p className="font-body text-text-secondary">
                    Redirigiendo a la página principal...
                  </p>
                </div>
              ) : (
                <>
                  <p className="font-body text-lg text-text-secondary">
                    La estructura fue verificada y está lista para usar. Define
                    los detalles finales para guardarla en tu biblioteca personal.
                  </p>

                  <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
                    <h3 className="mb-4 font-label text-xs font-bold uppercase tracking-widest text-text-disabled">
                      Resumen de Importación
                    </h3>
                    <div className="grid gap-6 md:grid-cols-3">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-text-disabled" />
                        <div>
                          <p className="font-label text-xs uppercase text-text-disabled">
                            Archivo origen
                          </p>
                          <p className="break-all text-sm font-semibold text-text-primary">
                            {state.file?.name ?? "—"}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="font-label text-xs uppercase text-text-disabled">
                          Estructura
                        </p>
                        <p className="text-sm font-semibold text-text-primary">
                          {totalEntities} campos totales
                        </p>
                      </div>
                      <div>
                        <p className="font-label text-xs uppercase text-text-disabled">
                          Estado
                        </p>
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-semibold text-text-primary">
                            {reviewedEntities} campos revisados
                          </p>
                          <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                            REVISIÓN COMPLETADA
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 rounded-xl border border-border bg-surface p-8 shadow-sm">
                    <SaveForm
                      onSubmit={handleSubmit}
                      initialValues={{
                        name: state.templateForm?.name,
                        description: state.templateForm?.description,
                        category: state.templateForm?.category,
                      }}
                      isSubmitting={status === "submitting"}
                    />
                  </div>

                  {errorMessage && (
                    <div className="flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/5 p-4">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-danger">
                          No se pudo guardar la plantilla
                        </p>
                        <p className="mt-1 text-sm text-text-secondary">
                          {errorMessage}
                        </p>
                      </div>
                      <button
                        onClick={() => setErrorMessage(null)}
                        className="shrink-0 rounded p-1 text-text-disabled transition-colors hover:text-text-secondary hover:bg-border/30"
                        aria-label="Cerrar error"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        </div>

        {status !== "success" && (
          <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 px-8 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-end gap-4">
              <button
                onClick={() => router.push(stepUrl(WizardStep.REVIEW))}
                className="rounded border border-border px-8 py-3 font-label text-sm font-semibold text-text-secondary transition-colors hover:bg-background"
              >
                Seguir editando
              </button>
              <button
                onClick={() => {
                  const form = document.querySelector("form");
                  if (form) form.requestSubmit();
                }}
                disabled={status === "submitting"}
                className={`rounded px-8 py-3 font-label text-sm font-bold text-white shadow-lg transition-colors ${
                  status === "submitting"
                    ? "bg-text-disabled cursor-not-allowed"
                    : "bg-accent shadow-accent/20 hover:bg-accent-hover"
                }`}
              >
                {status === "submitting" ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </span>
                ) : (
                  "Guardar en mi biblioteca"
                )}
              </button>
            </div>
          </footer>
        )}
      </WizardLayout>
    </AppShell>
  );
}

function SavePageInner() {
  const { state, setStep, reset } = useWizard();
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <SaveContent
      state={state}
      setStep={setStep}
      reset={reset}
      searchParams={searchParams}
      router={router}
    />
  );
}

export default function SavePage() {
  return (
    <Suspense fallback={null}>
      <SavePageInner />
    </Suspense>
  );
}