"use client";

import { useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { CaseProvider, useCase } from "@/lib/case/CaseContext";
import { NewCaseLayout } from "@/components/case/NewCaseLayout";
import {
  fetchTemplate,
  createCase,
  generateCase,
} from "@/lib/api/cases";

function NewCasePageContent() {
  const params = useParams();
  const router = useRouter();
  const templateId = params.templateId as string;
  const { state, setTemplate, setCase, setLoading, setError, setStatus, setGenerationError, saveForm } =
    useCase();

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        const template = await fetchTemplate(templateId);
        if (cancelled) return;
        setTemplate(template);

        const newCase = await createCase(templateId);
        if (cancelled) return;
        setCase(newCase);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudo cargar el nuevo caso"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [templateId, setTemplate, setCase, setLoading, setError]);

  const handleSave = useCallback(async () => {
    try {
      await saveForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar el borrador"
      );
    }
  }, [saveForm, setError]);

  const handleGenerate = useCallback(async () => {
    if (!state.caseId) return;
    setStatus("generating");
    setGenerationError(null);
    try {
      await saveForm();
      const generated = await generateCase(state.caseId);
      router.push(`/preview/${generated.id}`);
    } catch (err) {
      setGenerationError(
        err instanceof Error
          ? err.message
          : "Error al generar el documento"
      );
      setStatus("idle");
    }
  }, [state.caseId, saveForm, router, setStatus, setGenerationError]);

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

  return <NewCaseLayout onSave={handleSave} onGenerate={handleGenerate} />;
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
