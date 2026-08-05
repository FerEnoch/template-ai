"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { AppShell } from "@/components/shell/app-shell";
import { DocumentViewer } from "@/components/preview/DocumentViewer";
import { VerificationChecklist } from "@/components/preview/VerificationChecklist";
import { ExportPanel } from "@/components/preview/ExportPanel";
import { ExportSpinner } from "@/components/preview/ExportSpinner";
import { fetchCase, updateCase, generateCase, ApiError } from "@/lib/api/cases";
import type { CaseWithTemplate } from "@/lib/api/cases";
import { slugify } from "@/lib/export/exporters";
import { EditableTitle } from "@/components/preview/EditableTitle";
import { ArrowLeft, RefreshCw, FileText } from "lucide-react";

const ERROR_TYPE_LABELS: Record<string, string> = {
  NETWORK_ERROR: "Error de red",
  RATE_LIMIT: "Límite alcanzado",
  AUTH_ERROR: "Error de autenticación",
  MODEL_NOT_FOUND: "Modelo no disponible",
  INVALID_RESPONSE: "Respuesta inválida",
  UNKNOWN: "Error desconocido",
};

function errorTypeLabel(errorType: string): string {
  return ERROR_TYPE_LABELS[errorType] ?? errorType;
}

interface PreviewPageContentProps {
  caseId: string;
  router: AppRouterInstance;
}

export function PreviewPageContent({ caseId, router }: PreviewPageContentProps) {
  const [caseItem, setCaseItem] = useState<CaseWithTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<{
    message: string;
    errorType?: string;
  } | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDocumentSaving, setIsDocumentSaving] = useState(false);
  const regenerateInFlight = useRef(false);
  const regenerateControllerRef = useRef<AbortController | null>(null);

  const loadCase = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCase(caseId);
      setCaseItem(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el caso");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void loadCase();
    return () => {
      regenerateControllerRef.current?.abort();
    };
  }, [loadCase]);

  const handleRegenerate = useCallback(async () => {
    // Do not start regen while a paragraph save is in flight — avoids last-write
    // races between edited text and freshly generated text.
    if (regenerateInFlight.current || isDocumentSaving) return;
    regenerateInFlight.current = true;
    const regenerateController = new AbortController();
    regenerateControllerRef.current = regenerateController;
    setIsRegenerating(true);
    setRegenError(null);
    try {
      const updated = await generateCase(caseId, regenerateController.signal);
      setCaseItem(updated as CaseWithTemplate);
    } catch (err) {
      // Aborted fetches are expected on unmount / cleanup; don't surface them.
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const message =
        err instanceof Error ? err.message : "Error al regenerar el documento";
      const errorType = err instanceof ApiError ? err.errorType : undefined;
      setRegenError({ message, errorType });
    } finally {
      regenerateInFlight.current = false;
      setIsRegenerating(false);
    }
  }, [caseId, isDocumentSaving]);

  const handleContentTitleSave = useCallback(
    async (newValue: string, signal?: AbortSignal) => {
      const contentTitle = newValue.trim() || null;
      await updateCase(caseId, { contentTitle }, signal);
      setCaseItem((current) =>
        current ? { ...current, contentTitle } : current
      );
    },
    [caseId]
  );

  const handleReturnToForm = useCallback(() => {
    if (!caseItem) return;
    router.push(`/nuevo/${caseItem.template.id}`);
  }, [caseItem, router]);

  if (loading) {
    return (
      <AppShell activeSidebarItem="Biblioteca">
        <div className="flex flex-1 items-center justify-center p-12">
          <p className="font-label text-sm text-text-secondary">
            Cargando vista previa...
          </p>
        </div>
      </AppShell>
    );
  }

  if (error || !caseItem) {
    return (
      <AppShell activeSidebarItem="Biblioteca">
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12">
          <p className="font-label text-sm text-danger">
            {error ?? "No se encontró el caso"}
          </p>
          <button
            type="button"
            onClick={() => void loadCase()}
            className="rounded bg-accent px-4 py-2 font-label text-sm font-medium text-white hover:bg-accent-hover"
          >
            Reintentar
          </button>
        </div>
      </AppShell>
    );
  }

  if (!caseItem.generatedText) {
    router.replace(`/nuevo/${caseItem.template.id}`);
    return null;
  }

  const effectiveTitle = caseItem.contentTitle ?? caseItem.name ?? caseItem.template.name;
  const generatedAt = new Date(caseItem.updatedAt).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <AppShell activeSidebarItem="Biblioteca">
      {isExporting && <ExportSpinner />}

      <div className="w-full bg-white/80 backdrop-blur-md border-b border-stone-200 px-6 py-2.5 text-stone-500 text-sm font-label flex items-center justify-center">
        Revisá el documento final antes de exportar. Podés editar cualquier
        párrafo.
      </div>

      <div className="w-full bg-stone-50/80 border-b border-stone-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <FileText className="h-5 w-5 text-stone-500" aria-hidden="true" />
          <span className="text-sm font-label text-stone-500">Documento:</span>
          <EditableTitle
            value={caseItem.contentTitle ?? ""}
            onSave={handleContentTitleSave}
            minLength={0}
          >
            <h1 className="text-base font-label font-semibold text-stone-700">
              {effectiveTitle}
            </h1>
          </EditableTitle>
        </div>
      </div>

      {regenError && (
        <div className="w-full bg-danger/10 border-b border-danger/20 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            <p className="text-sm text-danger font-label">
              {regenError.message}
            </p>
            <div className="flex items-center gap-3">
              {regenError.errorType && (
                <details className="text-xs text-danger">
                  <summary className="cursor-pointer font-label select-none">
                    Detalles
                  </summary>
                  <code className="block mt-1 font-mono bg-white/60 px-2 py-1 rounded">
                    {errorTypeLabel(regenError.errorType)}
                  </code>
                </details>
              )}
              <button
                type="button"
                onClick={() => void handleRegenerate()}
                disabled={isRegenerating}
                className="text-sm font-label font-medium text-danger hover:text-danger/80 disabled:opacity-50"
              >
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-grow flex flex-col md:flex-row max-w-7xl mx-auto w-full px-6 py-8 gap-8">
        <div className="flex-grow w-full md:w-2/3">
          <DocumentViewer
            caseId={caseItem.id}
            title={effectiveTitle}
            generatedText={caseItem.generatedText}
            onUpdate={(text) =>
              setCaseItem((current) =>
                current ? { ...current, generatedText: text } : current
              )
            }
            onSavingChange={setIsDocumentSaving}
          />
        </div>

        <aside className="w-full md:w-1/3 flex flex-col gap-6">
          <VerificationChecklist />

          <ExportPanel
            caseId={caseItem.id}
            displayTitle={effectiveTitle}
            filenameSlug={slugify(effectiveTitle)}
            generatedText={caseItem.generatedText}
            onExportStart={() => setIsExporting(true)}
            onExportComplete={() => {
              setIsExporting(false);
              // Do NOT reload the case from the backend here: that would
              // overwrite local edited generatedText. ExportPanel still calls
              // updateCase for status; status column writes are out of scope.
            }}
            onExportError={() => setIsExporting(false)}
          />

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleReturnToForm}
              className="w-full bg-white border border-stone-200 text-stone-700 font-label font-bold py-3 px-4 flex items-center justify-center gap-3 hover:bg-stone-50 transition-all active:scale-[0.98]"
            >
              <ArrowLeft className="h-5 w-5" />
              Volver al formulario
            </button>
            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating || isDocumentSaving}
              className="w-full bg-white border border-stone-200 text-stone-700 font-label font-bold py-3 px-4 flex items-center justify-center gap-3 hover:bg-stone-50 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-5 w-5 ${isRegenerating ? "animate-spin" : ""}`}
              />
              Regenerar
            </button>
          </div>

          <section className="p-4 border-l-2 border-stone-200">
            <h3 className="text-[10px] font-label font-bold text-stone-400 uppercase tracking-widest mb-2">
              Detalles técnicos
            </h3>
            <p className="text-xs text-stone-500 font-label">
              Documento generado el {generatedAt}
            </p>
            <p className="text-xs text-stone-500 font-label">
              Estado: {caseItem.status}
            </p>
          </section>

          <footer className="mt-auto pt-10">
            <p className="text-[11px] leading-relaxed text-stone-400 font-label italic">
              Este documento ha sido generado mediante automatización legal.
              Template-AI no se responsabiliza por las modificaciones manuales
              realizadas por el usuario. Se recomienda la revisión final por un
              profesional del derecho matriculado.
            </p>
          </footer>
        </aside>
      </main>
    </AppShell>
  );
}
