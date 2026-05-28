"use client";

import { useState } from "react";
import {
  Users,
  Building2,
  Calendar,
  Paperclip,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import type { Entity } from "@template-ai/contracts";

type Confidence = "ALTA" | "MEDIA" | "BAJA";

interface EntityInspectorProps {
  entities: Entity[];
  onEntityUpdate?: (entity: Entity) => void;
}

const GROUP_CONFIG: Record<
  string,
  { label: string; icon: typeof Users; color: string }
> = {
  PARTES: { label: "Partes", icon: Users, color: "text-accent" },
  INMUEBLE: { label: "Inmueble", icon: Building2, color: "text-accent" },
  FECHAS: { label: "Fechas", icon: Calendar, color: "text-accent" },
  ANEXOS: { label: "Anexos", icon: Paperclip, color: "text-accent" },
};

const CONFIDENCE_STYLES: Record<
  Confidence,
  { label: string; dot: string; text: string; bg: string }
> = {
  ALTA: {
    label: "ALTA",
    dot: "bg-success",
    text: "text-success",
    bg: "bg-success/10",
  },
  MEDIA: {
    label: "MEDIA",
    dot: "bg-warning",
    text: "text-warning",
    bg: "bg-warning/10",
  },
  BAJA: {
    label: "BAJA",
    dot: "bg-danger",
    text: "text-danger",
    bg: "bg-danger/10",
  },
};

type Group = "PARTES" | "INMUEBLE" | "FECHAS" | "ANEXOS";

export function EntityInspector({ entities, onEntityUpdate }: EntityInspectorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<Group>>(
    new Set(["PARTES"])
  );
  const [priorityReviewed, setPriorityReviewed] = useState<Set<string>>(new Set());

  const toggleGroup = (group: Group) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  // Group entities
  const groupedEntities = entities.reduce<Record<Group, Entity[]>>(
    (acc, entity) => {
      const group = entity.group as Group;
      if (!acc[group]) acc[group] = [];
      acc[group].push(entity);
      return acc;
    },
    { PARTES: [], INMUEBLE: [], FECHAS: [], ANEXOS: [] }
  );

  // Priority items (BAJA confidence that haven't been reviewed)
  const priorityItems = entities.filter(
    (e) => e.confidence === "BAJA" && !e.reviewed
  );

  const handleMarkReviewed = (entityId: string) => {
    setPriorityReviewed((prev) => {
      const next = new Set(prev);
      next.add(entityId);
      return next;
    });
    const entity = entities.find((e) => e.id === entityId);
    if (entity && onEntityUpdate) {
      onEntityUpdate({ ...entity, reviewed: true });
    }
  };

  return (
    <div className="space-y-6">
      {/* Priority Review Section */}
      {priorityItems.length > 0 && (
        <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <div className="h-1 w-full bg-warning/20">
            <div
              className="h-full bg-warning transition-all duration-500"
              style={{
                width: `${Math.round(
                  ((entities.length - priorityItems.length) / entities.length) * 100
                )}%`,
              }}
            />
          </div>
          <div className="p-4">
            <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-warning">
              <AlertCircle className="h-4 w-4" />
              <span>Revisión prioritaria ({priorityItems.length} pendientes)</span>
            </div>
            <div className="space-y-4">
              {priorityItems.map((entity) => {
                const isReviewed = priorityReviewed.has(entity.id);
                return (
                  <div
                    key={entity.id}
                    className="border-l-4 border-warning pl-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-label text-xs font-bold text-text-primary">
                          {entity.label}
                        </h5>
                        <p className="my-0.5 text-sm font-bold text-text-primary">
                          {entity.value}
                        </p>
                        <p className="max-w-[200px] truncate text-[11px] italic text-text-secondary">
                          Confianza {entity.confidence} — necesita revisión
                        </p>
                      </div>
                      {!isReviewed ? (
                        <button
                          onClick={() => handleMarkReviewed(entity.id)}
                          className="px-2 py-1 text-xs font-bold text-accent hover:underline"
                        >
                          Revisar
                        </button>
                      ) : (
                        <span className="text-xs font-bold text-success">
                          ✓ Revisado
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Detected Groups */}
      <section className="space-y-3">
        <h4 className="ml-1 font-label text-[10px] font-bold uppercase tracking-widest text-text-secondary">
          Grupos detectados
        </h4>

        {(Object.keys(groupedEntities) as Group[]).map((group) => {
          const groupEntities = groupedEntities[group];
          if (groupEntities.length === 0) return null;

          const config = GROUP_CONFIG[group];
          const isExpanded = expandedGroups.has(group);
          const GroupIcon = config.icon;

          return (
            <div
              key={group}
              className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
            >
              <button
                onClick={() => toggleGroup(group)}
                className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-background"
              >
                <div className="flex items-center gap-2">
                  <GroupIcon className={`text-xl ${config.color}`} />
                  <span className="text-sm font-bold text-text-primary">
                    {config.label}
                  </span>
                  <span className="ml-1 rounded bg-background px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
                    {groupEntities.length}
                  </span>
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-text-secondary" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-text-secondary" />
                )}
              </button>

              {isExpanded && (
                <div className="divide-y divide-border border-t border-border">
                  {groupEntities.map((entity) => {
                    const conf = CONFIDENCE_STYLES[entity.confidence as Confidence];
                    return (
                      <div
                        key={entity.id}
                        className="group flex items-center justify-between p-3"
                      >
                        <div className="flex flex-1 items-center gap-4">
                          <span className="w-20 text-[11px] font-medium text-text-secondary">
                            {entity.label}
                          </span>
                          <span className="text-sm font-bold text-text-primary">
                            {entity.value}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex items-center gap-1 px-1 text-[10px] font-bold ${conf.text}`}
                          >
                            <div className={`h-1.5 w-1.5 rounded-full ${conf.dot}`} />
                            <span>{conf.label}</span>
                          </div>
                          {entity.sourceSpan && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                              Con traza
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty group state for Anexos */}
        {groupedEntities.ANEXOS.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface/50 p-6">
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