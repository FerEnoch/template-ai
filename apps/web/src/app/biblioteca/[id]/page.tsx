"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Calendar,
  Tag,
  Users,
  Building2,
  Paperclip,
  Shield,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";
import type { Template, Entity } from "@template-ai/contracts";

// ---------------------------------------------------------------------------
// Confidence badge (reuse patterns from EntityInspector)
// ---------------------------------------------------------------------------

type Confidence = "ALTA" | "MEDIA" | "BAJA";

const CONFIDENCE_STYLES: Record<
  Confidence,
  { label: string; dot: string; text: string }
> = {
  ALTA: { label: "ALTA", dot: "bg-success", text: "text-success" },
  MEDIA: { label: "MEDIA", dot: "bg-warning", text: "text-warning" },
  BAJA: { label: "BAJA", dot: "bg-danger", text: "text-danger" },
};

function ConfidenceBadge({ confidence }: { readonly confidence: Confidence }) {
  const style = CONFIDENCE_STYLES[confidence];
  return (
    <div className={`flex items-center gap-1 px-1 text-[10px] font-bold ${style.text}`}>
      <div className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      <span>{style.label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge (same styles as TemplateCard)
// ---------------------------------------------------------------------------

const statusConfig: Record<
  Template["status"],
  { label: string; className: string }
> = {
  published: {
    label: "Publicada",
    className: "bg-success/10 text-success border border-success/20",
  },
  draft: {
    label: "Borrador",
    className: "bg-accent/10 text-accent border border-accent/20",
  },
  archived: {
    label: "Archivada",
    className: "bg-neutral/10 text-neutral border border-border",
  },
};

// ---------------------------------------------------------------------------
// Group config (reuse from EntityInspector)
// ---------------------------------------------------------------------------

type Group = "PARTES" | "INMUEBLE" | "FECHAS" | "ANEXOS";

const GROUP_CONFIG: Record<
  Group,
  { label: string; icon: typeof Users; color: string }
> = {
  PARTES: { label: "Partes", icon: Users, color: "text-accent" },
  INMUEBLE: { label: "Inmueble", icon: Building2, color: "text-accent" },
  FECHAS: { label: "Fechas", icon: Calendar, color: "text-accent" },
  ANEXOS: { label: "Anexos", icon: Paperclip, color: "text-accent" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function groupEntities(entities: Entity[]): Record<Group, Entity[]> {
  const result: Record<Group, Entity[]> = {
    PARTES: [],
    INMUEBLE: [],
    FECHAS: [],
    ANEXOS: [],
  };

  for (const entity of entities) {
    const group = entity.group as Group;
    if (result[group]) {
      result[group].push(entity);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Breadcrumb */}
      <div className="h-4 w-40 rounded bg-border" />

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-border" />
          <div className="h-8 w-72 rounded bg-border" />
        </div>
        <div className="h-4 w-96 rounded bg-border" />
        <div className="flex gap-3">
          <div className="h-5 w-20 rounded bg-border" />
          <div className="h-5 w-24 rounded bg-border" />
          <div className="h-5 w-28 rounded bg-border" />
        </div>
      </div>

      {/* Entity groups */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-5 w-5 rounded bg-border" />
            <div className="h-5 w-24 rounded bg-border" />
            <div className="h-4 w-8 rounded bg-border" />
          </div>
          {Array.from({ length: 3 }).map((_, j) => (
            <div key={j} className="flex items-center justify-between border-t border-border py-3">
              <div className="flex items-center gap-4">
                <div className="h-3 w-16 rounded bg-border" />
                <div className="h-4 w-40 rounded bg-border" />
              </div>
              <div className="h-3 w-12 rounded bg-border" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({ message }: { readonly message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-danger/20 bg-danger/5 px-6 py-16 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-danger" />
      <h2 className="mb-2 font-headline text-lg font-semibold text-text-primary">
        No se encontró la plantilla
      </h2>
      <p className="mb-6 max-w-sm font-body text-sm text-text-secondary">
        {message}
      </p>
      <Link
        href="/biblioteca"
        className="inline-flex items-center gap-2 rounded-lg border border-danger/30 bg-surface px-6 py-2.5 font-label font-semibold text-danger transition-colors hover:bg-danger/10"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a Biblioteca
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Entity group section
// ---------------------------------------------------------------------------

function EntityGroupSection({
  group,
  entities,
}: {
  readonly group: Group;
  readonly entities: Entity[];
}) {
  if (entities.length === 0) return null;

  const config = GROUP_CONFIG[group];
  const GroupIcon = config.icon;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      {/* Group header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <GroupIcon className={`h-5 w-5 ${config.color}`} />
        <span className="font-headline text-sm font-semibold text-text-primary">
          {config.label}
        </span>
        <span className="ml-1 rounded bg-background px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
          {entities.length}
        </span>
      </div>

      {/* Entity list */}
      <div className="divide-y divide-border">
        {entities.map((entity) => (
          <div
            key={entity.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="flex flex-1 items-center gap-4">
              <span className="w-20 shrink-0 text-[11px] font-medium text-text-secondary">
                {entity.label}
              </span>
              <span className="text-sm font-bold text-text-primary">
                {entity.value}
              </span>
            </div>
            <ConfidenceBadge confidence={entity.confidence as Confidence} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TemplateDetailPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [id, setId] = useState<string | null>(null);

  // Unwrap params promise (Next.js 15+ async params)
  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  const fetchTemplate = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/templates/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("La plantilla que buscás no existe o fue eliminada.");
        }
        throw new Error("Error al obtener la plantilla");
      }
      const data: Template = await response.json();
      setTemplate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  let content: React.ReactNode;

  if (isLoading) {
    content = <DetailSkeleton />;
  } else if (error || !template) {
    content = <ErrorState message={error ?? "Plantilla no encontrada"} />;
  } else {
    const status = statusConfig[template.status];
    const grouped = groupEntities(template.entities);

    content = (
      <div className="space-y-6">
        {/* Breadcrumb */}
        <Link
          href="/biblioteca"
          className="inline-flex items-center gap-1.5 font-label text-xs font-semibold text-text-secondary transition-colors hover:text-accent"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a Biblioteca
        </Link>

        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-accent/10">
              <FileText className="h-6 w-6 text-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="font-headline text-2xl font-bold text-text-primary">
                {template.name}
              </h1>
              {template.description && (
                <p className="mt-1 font-body text-sm text-text-secondary">
                  {template.description}
                </p>
              )}
            </div>
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${status.className}`}
            >
              {status.label}
            </span>
            <span className="flex items-center gap-1.5 font-label text-xs text-text-secondary">
              <Tag className="h-3.5 w-3.5" />
              {template.category}
            </span>
            <span className="flex items-center gap-1.5 font-label text-xs text-text-secondary">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(template.createdAt)}
            </span>
            <span className="flex items-center gap-1.5 font-label text-xs text-text-secondary">
              <Shield className="h-3.5 w-3.5" />
              {template.entities.length}{" "}
              {template.entities.length === 1 ? "campo" : "campos"}
            </span>
          </div>
        </div>

        {/* Entity groups */}
        <section className="space-y-4">
          <h2 className="font-label text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            Entidades detectadas
          </h2>

          {(Object.keys(grouped) as Group[]).map((group) => (
            <EntityGroupSection
              key={group}
              group={group}
              entities={grouped[group]}
            />
          ))}

          {grouped.ANEXOS.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-surface/50 p-6">
              <Paperclip className="text-3xl text-text-disabled opacity-40" />
              <p className="text-[11px] font-medium text-text-secondary">
                No se han detectado anexos
              </p>
            </div>
          )}
        </section>
      </div>
    );
  }

  return (
    <AppShell activeSidebarItem="Biblioteca">
      <div className="mx-auto max-w-4xl px-6 pb-16 pt-10">{content}</div>
    </AppShell>
  );
}
