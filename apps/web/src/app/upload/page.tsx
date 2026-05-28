"use client";

import { Suspense, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info, CheckCircle2, AlertTriangle, Ruler, ArrowRight, Shield } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import { WizardLayout, FileDropzone } from "@/components/wizard";
import { useWizard } from "@/lib/wizard";
import { WizardStep } from "@/lib/wizard";
import { saveDraft, clearDraft } from "@/lib/wizard";

function UploadContent() {
  const { state, setFile, nextStep, setStep } = useWizard();
  const router = useRouter();
  const searchParams = useSearchParams();

  // If user arrived directly (no ?step=), set step
  useEffect(() => {
    const stepParam = searchParams.get("step");
    if (!stepParam) {
      setStep(WizardStep.UPLOAD);
    }
  }, [searchParams, setStep]);

  const handleFileAccepted = useCallback(
    (file: { name: string; size: number; type: string }, fileObject: File) => {
      setFile(file, fileObject);
      saveDraft(file);
    },
    [setFile]
  );

  const handleFileRemoved = useCallback(() => {
    setFile(null);
    clearDraft();
  }, [setFile]);

  const handleContinue = useCallback(() => {
    if (!state.file) return;
    nextStep();
  }, [state.file, nextStep]);

  return (
    <AppShell footer={false} activeSidebarItem="Nuevo Documento">
      <WizardLayout>
        <div className="mx-auto w-full max-w-6xl px-6 pb-36 pt-8 md:px-12">
          {/* Header */}
          <div className="mb-10">
            <h1 className="font-headline text-4xl font-light text-text-primary">
              Crear nueva plantilla
            </h1>
          </div>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            {/* CENTRAL: Dropzone */}
            <div className="space-y-6 lg:col-span-8">
              <FileDropzone
                onFileAccepted={handleFileAccepted}
                onFileRemoved={handleFileRemoved}
                acceptedFile={state.file}
              />
            </div>

            {/* RIGHT: Guidance panel */}
            <div className="lg:col-span-4">
              <div className="sticky top-24 rounded-xl border border-border bg-surface/70 p-6">
                <div className="mb-4 flex items-center gap-2 text-text-primary">
                  <Info className="h-5 w-5 text-accent" />
                  <h2 className="font-headline text-lg font-semibold">
                    Recomendaciones para mejores resultados
                  </h2>
                </div>
                <ul className="mb-8 space-y-4">
                  <li className="flex gap-3 text-sm leading-relaxed text-text-secondary">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-text-disabled" />
                    <span>
                      Usá archivos con <strong>texto seleccionable</strong> para
                      un análisis preciso.
                    </span>
                  </li>
                  <li className="flex gap-3 text-sm leading-relaxed text-text-secondary">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-text-disabled" />
                    <span>
                      Evitá documentos escaneados de baja calidad o rotados.
                    </span>
                  </li>
                  <li className="flex gap-3 text-sm leading-relaxed text-text-secondary">
                    <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-text-disabled" />
                    <span>
                      El tamaño máximo permitido por archivo es{" "}
                      <strong>25 MB</strong>.
                    </span>
                  </li>
                </ul>
                <div className="border-t border-border pt-6">
                  <a
                    href="#"
                    className="group flex items-center justify-between font-label text-xs text-text-secondary transition-colors hover:text-text-primary"
                  >
                    Cómo tratamos tus documentos
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed bottom bar */}
        <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/90 backdrop-blur-md md:ml-60">
          <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
            <div className="flex items-center gap-3 text-text-secondary">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background">
                <Shield className="h-4 w-4" />
              </div>
              <p className="font-label text-sm">
                Vas a revisar todo lo que detectamos antes de guardar.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/")}
                className="rounded-lg px-6 py-2 font-label font-medium text-text-secondary transition-colors hover:bg-background"
              >
                Cancelar
              </button>
              <button
                onClick={handleContinue}
                disabled={!state.file}
                className={`rounded-lg px-8 py-2.5 font-label font-semibold shadow-lg transition-all duration-200 ${
                  state.file
                    ? "bg-accent text-white shadow-accent/10 hover:bg-accent-hover active:translate-y-0"
                    : "bg-text-disabled/30 text-white cursor-not-allowed"
                }`}
              >
                Continuar al análisis
              </button>
            </div>
          </div>
        </footer>
      </WizardLayout>
    </AppShell>
  );
}

export default function UploadPage() {
  return (
    <Suspense fallback={null}>
      <UploadContent />
    </Suspense>
  );
}