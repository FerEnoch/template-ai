// TODO: review-page - fix pagination message "página 1 de 12"
// TODO: review-page - fix "85% IA Confidence"
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  ZoomIn,
  ZoomOut,
  Printer,
  Shield,
  AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { WizardLayout, EntityInspector } from "@/components/wizard";
import { renderHighlightedText, useWizard, stepUrl } from "@/lib/wizard";
import { WizardStep } from "@/lib/wizard";
import type { Entity } from "@template-ai/contracts";

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewContent />
    </Suspense>
  );
}

function ReviewContent() {
  return <ReviewInner />;
}

function ReviewInner() {
  const { state, setStep, nextStep, updateEntity } = useWizard();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pendingBajaCount, setPendingBajaCount] = useState(0);
  const [isConfirmEnabled, setIsConfirmEnabled] = useState(false);

  // Guard: redirect if no analysis result
  useEffect(() => {
    const stepParam = searchParams.get("step");
    if (!stepParam) {
      setStep(WizardStep.REVIEW);
    }
    if (!state.file) {
      router.replace(stepUrl(WizardStep.UPLOAD));
      return;
    }
    if (!state.analysisResultId && state.entities.length === 0) {
      router.replace(stepUrl(WizardStep.ANALYSIS));
      return;
    }
  }, [searchParams, state, router, setStep]);

  // Count pending BAJA entities
  useEffect(() => {
    const bajaCount = state.entities.filter(
      (e) => e.confidence === "BAJA" && !e.reviewed
    ).length;
    setPendingBajaCount(bajaCount);
    setIsConfirmEnabled(bajaCount === 0);
  }, [state.entities]);

  const handleEntityUpdate = useCallback(
    async (entity: Entity) => {
      // Optimistically update locally
      updateEntity(entity);

      try {
        await fetch(
          `/api/review/${state.analysisResultId}/entities/${entity.id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reviewed: entity.reviewed,
              value: entity.value,
              ...(entity.excluded !== undefined && { excluded: entity.excluded }),
            }),
          }
        );
      } catch {
        // Keep local state on error — user can still proceed
      }
    },
    [state.analysisResultId, updateEntity]
  );

  const handleConfirm = useCallback(() => {
    if (pendingBajaCount === 0) {
      nextStep();
    }
  }, [pendingBajaCount, nextStep]);

  return (
    <AppShell sidebar={false}>
      <WizardLayout>
        {/* Main split layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Document Viewer (62%) */}
          <section className="flex w-[62%] flex-col overflow-hidden border-r border-border bg-surface">
            {/* Title bar */}
            <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-accent" />
                <h2 className="font-headline text-sm font-bold text-text-primary">
                  {state.file?.name ?? "Documento"}
                </h2>
              </div>
              <div className="flex gap-1">
                <button className="rounded p-1.5 text-text-secondary transition-colors hover:bg-border">
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button className="rounded p-1.5 text-text-secondary transition-colors hover:bg-border">
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button className="rounded p-1.5 text-text-secondary transition-colors hover:bg-border">
                  <Printer className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Document canvas */}
            <div className="flex flex-1 justify-center overflow-y-auto bg-background p-12">
              <article className="min-h-[1200px] w-full max-w-3xl bg-surface p-16 font-body leading-relaxed text-text-primary shadow-sm">
                {state.extractedText ? (
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap font-body text-sm leading-relaxed text-text-primary">
                    {renderHighlightedText(state.extractedText, state.entities)}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">
                    Vista previa no disponible para este documento
                  </p>
                )}

                {/* Page footer */}
                <div className="mt-20 flex justify-between border-t border-border pt-4 text-xs text-text-disabled">
                  <span>Página 1 de 12</span>
                  <span>template-ai legal review mode</span>
                </div>
              </article>
            </div>
          </section>

          {/* Right: Review Panel (38%) */}
          <section className="flex w-[38%] flex-col overflow-hidden bg-background">
            {/* Panel header */}
            <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-4">
              <h3 className="font-headline text-lg font-bold text-text-primary">
                Entidades y datos detectados
              </h3>
              <span className="rounded bg-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
                85% IA Confidence
              </span>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto p-6 custom-scrollbar">
              {/* Priority review banner */}
              {pendingBajaCount > 0 && (
                <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-4 py-3">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
                  <div>
                    <p className="text-sm font-bold text-warning">
                      Revisión prioritaria
                    </p>
                    <p className="text-xs text-text-secondary">
                      {pendingBajaCount} campo{pendingBajaCount !== 1 ? "s" : ""} con confianza BAJA {pendingBajaCount !== 1 ? "necesitan" : "necesita"} tu atención antes de continuar
                    </p>
                  </div>
                </div>
              )}

              {/* Entity Inspector */}
              <EntityInspector
                entities={state.entities}
                onEntityUpdate={handleEntityUpdate}
              />
            </div>
          </section>
        </div>

        {/* Sticky bottom action bar */}
        <footer className="flex shrink-0 items-center justify-between border-t border-border bg-surface px-8 py-3 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-3 text-text-secondary">
            <Shield className="h-5 w-5 text-accent" />
            <span className="font-label text-xs font-medium tracking-tight">
              Revisión humana obligatoria — confirmá la estructura antes de
              guardar
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(stepUrl(WizardStep.ANALYSIS))}
              className="rounded border border-accent px-5 py-2 text-xs font-bold text-accent transition-colors hover:bg-accent/5"
            >
              Seguir revisando
            </button>
            <div className="flex flex-col items-center">
              <button
                onClick={handleConfirm}
                disabled={!isConfirmEnabled}
                className={`rounded px-8 py-2 text-xs font-bold transition-all ${
                  isConfirmEnabled
                    ? "bg-accent text-white hover:bg-accent-hover"
                    : "bg-text-disabled/30 text-white cursor-not-allowed"
                }`}
              >
                Confirmar estructura
              </button>
              {!isConfirmEnabled && (
                <span className="mt-1 text-[10px] font-medium text-danger">
                  Quedan {pendingBajaCount} filas con confianza BAJA por revisar
                </span>
              )}
            </div>
          </div>
        </footer>
      </WizardLayout>
    </AppShell>
  );
}
