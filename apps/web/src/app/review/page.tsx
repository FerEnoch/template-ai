"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  ZoomIn,
  ZoomOut,
  Printer,
  Shield,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { WizardLayout, EntityInspector } from "@/components/wizard";
import { useWizard, stepUrl } from "@/lib/wizard";
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
            body: JSON.stringify({ reviewed: entity.reviewed, value: entity.value }),
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
                <h1 className="mb-12 text-center font-headline text-xl font-bold uppercase tracking-widest">
                  Contrato de Arrendamiento de Vivienda
                </h1>

                <p className="mb-6">En Madrid, a 15 de Octubre de 2023.</p>
                <p className="mb-6 font-bold">REUNIDOS</p>
                <p className="mb-6">
                  De una parte, como{" "}
                  <span
                    className="rounded-sm px-1"
                    style={{
                      backgroundColor: "rgba(34, 197, 94, 0.1)",
                      borderBottom: "2px solid rgba(34, 197, 94, 0.4)",
                    }}
                  >
                    ARRENDADOR
                  </span>
                  , el Sr. Don Julián Ruiz de Azúa, mayor de edad, con DNI
                  12345678X y domicilio en{" "}
                  <span
                    className="rounded-sm px-1"
                    style={{
                      backgroundColor: "rgba(245, 158, 11, 0.1)",
                      borderBottom: "2px solid rgba(245, 158, 11, 0.4)",
                    }}
                  >
                    Calle Mayor 12
                  </span>
                  , 2º Izquierda, 28013, Madrid.
                </p>
                <p className="mb-6">
                  De otra parte, como ARRENDATARIO, la Sra. Doña Elena Blanco
                  Marín, con DNI 87654321Y, y con domicilio a efectos de
                  notificaciones en la propia vivienda objeto del presente
                  contrato.
                </p>
                <p className="mb-6 font-bold">ESTIPULACIONES</p>
                <p className="mb-6">
                  <span className="font-bold">PRIMERA. Objeto.</span> El
                  Arrendador cede en arrendamiento al Arrendatario la vivienda
                  sita en la{" "}
                  <span
                    className="rounded-sm px-1"
                    style={{
                      backgroundColor: "rgba(245, 158, 11, 0.1)",
                      borderBottom: "2px solid rgba(245, 158, 11, 0.4)",
                    }}
                  >
                    Calle Mayor 12
                  </span>{" "}
                  de Madrid, para ser destinada exclusivamente a vivienda
                  permanente del Arrendatario y su familia.
                </p>
                <p className="mb-6">
                  <span className="font-bold">SEGUNDA. Renta.</span> La renta
                  mensual acordada por las partes es de{" "}
                  <span
                    className="rounded-sm px-1 font-bold"
                    style={{
                      backgroundColor: "rgba(245, 158, 11, 0.1)",
                      borderBottom: "2px solid rgba(245, 158, 11, 0.4)",
                    }}
                  >
                    2.500€
                  </span>{" "}
                  (dos mil quinientos euros), pagaderos dentro de los cinco
                  primeros días de cada mes mediante transferencia bancaria.
                </p>
                <p className="mb-12">
                  <span className="font-bold">TERCERA. Duración.</span> El
                  presente contrato tendrá una duración de un (1) año, prorrogable
                  según los plazos establecidos en la Ley de Arrendamientos
                  Urbanos vigente.
                </p>

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