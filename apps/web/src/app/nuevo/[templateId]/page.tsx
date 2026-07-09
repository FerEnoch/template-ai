"use client";

import { useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { CaseProvider, useCase } from "@/lib/case/CaseContext";
import { NewCaseLayout } from "@/components/case/NewCaseLayout";
import {
  fetchTemplate,
  createCase,
  generateCase,
  fetchCase,
  updateCase,
} from "@/lib/api/cases";

function NewCasePageContent() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.templateId as string;
  const {
    state,
    dispatch,
    setTemplate,
    setCase,
    setLoading,
    setError,
    setStatus,
    setGenerationError,
    saveForm,
    clearDraft,
  } = useCase();

  useEffect(() => {
    const controller = new AbortController();

    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        const template = await fetchTemplate(templateId, controller.signal);
        if (controller.signal.aborted) return;
        setTemplate(template);

        const newCase = await createCase(templateId, controller.signal);
        if (controller.signal.aborted) return;
        setCase(newCase);
      } catch (err) {
        // Aborted fetches are expected on unmount / cleanup; don't surface them.
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar el nuevo caso"
        );
      } finally {
        // Only the active effect run may clear loading. The shared
        // bootstrapInFlight ref was removed because it could not distinguish
        // which run was active under StrictMode/Fast Refresh.
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      controller.abort();
    };
  }, [templateId, setTemplate, setCase, setLoading, setError]);

  const handleSave = useCallback(async () => {
    try {
      await saveForm();
      if (state.caseId) {
        clearDraft(state.caseId);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar el borrador"
      );
    }
  }, [saveForm, setError, clearDraft, state.caseId]);

  const handleRenameCase = useCallback(
    async (name: string, signal?: AbortSignal) => {
      if (!state.caseId) return;
      await updateCase(state.caseId, { name }, signal);
      dispatch({ type: "SET_CASE_NAME", payload: name });
    },
    [state.caseId, dispatch]
  );

  const generationInFlight = useRef(false);
  const generateControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      generateControllerRef.current?.abort();
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!state.caseId || generationInFlight.current) return;
    generationInFlight.current = true;
    const generateController = new AbortController();
    generateControllerRef.current = generateController;
    setStatus("generating");
    setGenerationError(null);
    try {
      await saveForm();
      const generated = await generateCase(
        state.caseId,
        generateController.signal
      );
      router.push(`/preview/${generated.id}`);
      clearDraft(state.caseId);
    } catch (err) {
      // Aborted fetches are expected on unmount / cleanup; don't surface them.
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }

      // Check if the case was generated/archived despite the error
      let currentStatus: string | null = null;
      try {
        const currentCase = await fetchCase(state.caseId);
        currentStatus = currentCase.status;
      } catch {
        // Could not check — fall through to generic error handling
      }

      if (currentStatus === "generado") {
        router.push(`/preview/${state.caseId}`);
        return;
      }

      if (currentStatus === "archivado") {
        router.push("/biblioteca");
        return;
      }

      // Any other error — surface it
      setGenerationError(
        err instanceof Error
          ? err.message
          : "Error al generar el documento"
      );
      setStatus("idle");
    } finally {
      generationInFlight.current = false;
    }
  }, [state.caseId, saveForm, router, setStatus, setGenerationError, clearDraft]);

  if (state.loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <p className="font-label text-sm text-text-secondary">
          Cargando plantilla...
        </p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12">
        <p className="font-label text-sm text-danger">{state.error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded bg-accent px-4 py-2 font-label text-sm font-medium text-white hover:bg-accent-hover"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <NewCaseLayout
      onSave={handleSave}
      onGenerate={handleGenerate}
      onRename={handleRenameCase}
    />
  );
}

export default function NuevoCasoPage() {
  return (
    <AppShell activeSidebarItem="Biblioteca">
      <CaseProvider>
        <NewCasePageContent />
      </CaseProvider>
    </AppShell>
  );
}
