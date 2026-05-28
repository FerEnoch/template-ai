import Link from "next/link";
import { FolderOpen, AlertTriangle, Loader2 } from "lucide-react";
import type { Template } from "@template-ai/contracts";
import { TemplateCard } from "./TemplateCard";

interface TemplateGridProps {
  readonly templates: Template[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry?: () => void;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-border" />
          <div className="space-y-2">
            <div className="h-4 w-40 rounded bg-border" />
            <div className="h-3 w-56 rounded bg-border" />
          </div>
        </div>
        <div className="h-5 w-16 rounded bg-border" />
      </div>
      <div className="flex items-center gap-4 border-t border-border pt-3">
        <div className="h-3 w-20 rounded bg-border" />
        <div className="h-3 w-24 rounded bg-border" />
        <div className="h-3 w-16 rounded bg-border" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
        <FolderOpen className="h-8 w-8 text-accent" />
      </div>
      <h3 className="mb-2 font-headline text-xl font-semibold text-text-primary">
        No hay plantillas guardadas
      </h3>
      <p className="mb-8 max-w-sm font-body text-sm text-text-secondary">
        Creá tu primera plantilla subiendo un documento legal. Template AI
        analizará la estructura y te permitirá guardarlo para reutilizar.
      </p>
      <Link
        href="/upload?step=upload"
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 font-label font-semibold text-white shadow-lg shadow-accent/10 transition-all duration-200 hover:bg-accent-hover hover:shadow-accent/20 active:translate-y-0"
      >
        Crear nueva plantilla
      </Link>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-danger/20 bg-danger/5 px-6 py-16 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-danger" />
      <h3 className="mb-2 font-headline text-lg font-semibold text-text-primary">
        Error al cargar las plantillas
      </h3>
      <p className="mb-6 max-w-sm font-body text-sm text-text-secondary">
        {message}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 rounded-lg border border-danger/30 bg-surface px-6 py-2.5 font-label font-semibold text-danger transition-colors hover:bg-danger/10"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

export function TemplateGrid({
  templates,
  isLoading,
  error,
  onRetry,
}: TemplateGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  if (templates.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}
    </div>
  );
}