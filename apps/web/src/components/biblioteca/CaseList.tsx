"use client";

import Link from "next/link";
import {
  FileText,
  Calendar,
  AlertTriangle,
  Loader2,
  Files,
} from "lucide-react";
import type { Case, Template } from "@template-ai/contracts";

interface CaseListProps {
  readonly cases: Case[];
  readonly templates: Template[];
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly onRetry?: () => void;
}

const statusConfig: Record<
  Case["status"],
  { label: string; className: string }
> = {
  borrador: {
    label: "Borrador",
    className: "bg-accent/10 text-accent border border-accent/20",
  },
  generado: {
    label: "Generado",
    className: "bg-success/10 text-success border border-success/20",
  },
  exportado: {
    label: "Exportado",
    className: "bg-info/10 text-info border border-info/20",
  },
  archivado: {
    label: "Archivado",
    className: "bg-neutral/10 text-neutral border border-border",
  },
};

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function resolveTemplateName(
  templateId: string,
  templates: Template[],
): string {
  return (
    templates.find((template) => template.id === templateId)?.name ??
    "Plantilla desconocida"
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-surface p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-border" />
          <div className="h-4 w-40 rounded bg-border" />
        </div>
        <div className="h-5 w-16 rounded bg-border" />
      </div>
      <div className="flex items-center gap-4 border-t border-border pt-3">
        <div className="h-3 w-24 rounded bg-border" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-20 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
        <Files className="h-8 w-8 text-accent" />
      </div>
      <h3 className="mb-2 font-headline text-xl font-semibold text-text-primary">
        Todavía no generaste ningún documento
      </h3>
      <p className="mb-8 max-w-sm font-body text-sm text-text-secondary">
        Creá tu primer caso desde una de tus plantillas para verlo acá.
      </p>
      <a
        href="#plantillas"
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-6 py-2.5 font-label font-semibold text-white shadow-lg shadow-accent/10 transition-all duration-200 hover:bg-accent-hover hover:shadow-accent/20 active:translate-y-0"
      >
        Ver mis plantillas
      </a>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-danger/20 bg-danger/5 px-6 py-16 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-danger" />
      <h3 className="mb-2 font-headline text-lg font-semibold text-text-primary">
        Error al cargar los documentos
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

interface CaseCardProps {
  readonly caseData: Case;
  readonly templateName: string;
}

function CaseCard({ caseData, templateName }: CaseCardProps) {
  const status = statusConfig[caseData.status];

  return (
    <Link
      href={`/preview/${caseData.id}`}
      className="group block w-full rounded-xl border border-border bg-surface p-5 text-left shadow-sm transition-all duration-150 hover:border-accent/30 hover:shadow-md active:scale-[0.99]"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10">
            <FileText className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0">
            <h3 className="font-headline text-base font-semibold leading-tight text-text-primary group-hover:text-accent">
              {templateName}
            </h3>
          </div>
        </div>
        <span
          className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <div className="flex items-center gap-4 border-t border-border pt-3 font-label text-xs text-text-secondary">
        <span className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {formatDate(caseData.createdAt)}
        </span>
      </div>
    </Link>
  );
}

export function CaseList({
  cases,
  templates,
  isLoading,
  error,
  onRetry,
}: CaseListProps) {
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

  if (cases.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cases.map((caseData) => (
        <CaseCard
          key={caseData.id}
          caseData={caseData}
          templateName={resolveTemplateName(caseData.templateId, templates)}
        />
      ))}
    </div>
  );
}
