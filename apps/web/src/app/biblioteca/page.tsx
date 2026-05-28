"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { TemplateGrid } from "@/components/biblioteca/TemplateGrid";
import type { Template } from "@template-ai/contracts";

export default function BibliotecaPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      setError(
        err instanceof Error ? err.message : "Error desconocido"
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return (
    <AppShell>
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

        {/* Grid */}
        <TemplateGrid
          templates={templates}
          isLoading={isLoading}
          error={error}
          onRetry={fetchTemplates}
        />
      </div>
    </AppShell>
  );
}