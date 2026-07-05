"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { TemplateGrid } from "@/components/biblioteca/TemplateGrid";
import { CaseList } from "@/components/biblioteca/CaseList";
import { updateTemplateName } from "@/lib/api/templates";
import { updateCase } from "@/lib/api/cases";
import type { Template, Case } from "@template-ai/contracts";

export default function BibliotecaPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cases, setCases] = useState<Case[]>([]);
  const [casesIsLoading, setCasesIsLoading] = useState(true);
  const [casesError, setCasesError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/templates");
      if (!response.ok) {
        throw new Error("Error al obtener las plantillas");
      }
      const data: Template[] = await response.json();
      setTemplates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchCases = useCallback(async () => {
    setCasesIsLoading(true);
    setCasesError(null);
    try {
      const response = await fetch("/api/cases");
      if (!response.ok) {
        throw new Error("Error al obtener los documentos generados");
      }
      const data: Case[] = await response.json();
      setCases(data);
    } catch (err) {
      setCasesError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setCasesIsLoading(false);
    }
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setTemplates((prev) => prev.filter((template) => template.id !== id));
    },
    [setTemplates],
  );

  const handleDeleteError = useCallback(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleDeleteCase = useCallback((id: string) => {
    setCases((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const handleDeleteCaseError = useCallback(() => {
    fetchCases();
  }, [fetchCases]);

  const handleRenameTemplate = useCallback(
    async (id: string, name: string) => {
      let previousTemplates: Template[] = [];
      setTemplates((prev) => {
        previousTemplates = prev;
        return prev.map((template) =>
          template.id === id ? { ...template, name } : template,
        );
      });

      try {
        const updated = await updateTemplateName(id, name);
        setTemplates((prev) =>
          prev.map((template) =>
            template.id === id ? { ...template, name: updated.name } : template,
          ),
        );
      } catch (error) {
        setTemplates(previousTemplates);
        throw error;
      }
    },
    [],
  );

  const handleRenameCase = useCallback(
    async (id: string, name: string | null) => {
      let previousCases: Case[] = [];
      setCases((prev) => {
        previousCases = prev;
        return prev.map((caseItem) =>
          caseItem.id === id ? { ...caseItem, name } : caseItem,
        );
      });

      try {
        const updated = await updateCase(id, { name });
        setCases((prev) =>
          prev.map((caseItem) =>
            caseItem.id === id
              ? { ...caseItem, name: updated.name ?? null }
              : caseItem,
          ),
        );
      } catch (error) {
        setCases(previousCases);
        throw error;
      }
    },
    [],
  );

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  return (
    <AppShell activeSidebarItem="Biblioteca">
      <div className="mx-auto max-w-7xl px-6 pb-16 pt-10">
        {/* Header */}
        <header className="mb-8">
          <h1 className="font-headline text-3xl font-bold text-text-primary">
            Mi Biblioteca
          </h1>
          <p className="mt-1 font-body text-sm text-text-secondary">
            Gestioná tus plantillas legales y reutilizá documentos verificados.
          </p>
          {!isLoading && !error && templates.length > 0 && (
            <p className="mt-3 font-label text-xs font-bold uppercase tracking-widest text-text-disabled">
              {templates.length}{" "}
              {templates.length === 1
                ? "plantilla guardada"
                : "plantillas guardadas"}
            </p>
          )}
        </header>

        {/* Mis Plantillas */}
        <section id="plantillas" className="mb-16">
          <div className="mb-6">
            <h2 className="font-headline text-2xl font-bold text-text-primary">
              Mis Plantillas
            </h2>
            <p className="mt-1 font-body text-sm text-text-secondary">
              Accedé a tus plantillas legales guardadas para generar nuevos
              documentos.
            </p>
          </div>
          <TemplateGrid
            templates={templates}
            isLoading={isLoading}
            error={error}
            onRetry={fetchTemplates}
            onDelete={handleDelete}
            onDeleteError={handleDeleteError}
            onRename={handleRenameTemplate}
          />
        </section>

        {/* Documentos Generados */}
        <section id="documentos-generados">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <h2 className="font-headline text-2xl font-bold text-text-primary">
                Documentos Generados
              </h2>
              {!casesIsLoading && !casesError && (
                <span className="rounded-full bg-accent/10 px-3 py-1 font-label text-xs font-bold text-accent">
                  {cases.length}
                </span>
              )}
            </div>
            <p className="mt-1 font-body text-sm text-text-secondary">
              Revisá los documentos que generaste a partir de tus plantillas.
            </p>
          </div>
          <CaseList
            cases={cases}
            templates={templates}
            isLoading={casesIsLoading}
            error={casesError}
            onRetry={fetchCases}
            onDelete={handleDeleteCase}
            onDeleteError={handleDeleteCaseError}
            onRename={handleRenameCase}
          />
        </section>
      </div>
    </AppShell>
  );
}
