"use client";

import { useCallback, useState } from "react";
import {
  Users,
  Building2,
  Calendar,
  Paperclip,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Ban,
  Plus,
} from "lucide-react";
import type { Entity } from "@template-ai/contracts";
import { MANUAL_ENTITY_LIMIT } from "@template-ai/contracts";
import { EntityEditModal } from "./EntityEditModal";

type Confidence = "ALTA" | "MEDIA" | "BAJA";

interface EntityInspectorProps {
  entities: Entity[];
  onEntityUpdate?: (entity: Entity) => void;
  onAddEntity?: () => void;
  manualEntityCount?: number;
  manualEntityLimit?: number;
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

export function EntityInspector({
  entities,
  onEntityUpdate,
  onAddEntity,
  manualEntityCount = 0,
  manualEntityLimit = MANUAL_ENTITY_LIMIT,
}: EntityInspectorProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<Group>>(
    new Set(["PARTES"])
  );
  const [priorityReviewed, setPriorityReviewed] = useState<Set<string>>(new Set());
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showExcluded, setShowExcluded] = useState(false);

  const isLimitReached = manualEntityCount >= manualEntityLimit;

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

  // Group entities — BAJA confidence first within each group
  const sortedEntities = [...entities].sort((a, b) => {
    const order: Record<string, number> = { BAJA: 0, MEDIA: 1, ALTA: 2 };
    return (order[a.confidence] ?? 3) - (order[b.confidence] ?? 3);
  });

  const groupedEntities = sortedEntities.reduce<Record<Group, Entity[]>>(
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

  const handleEditEntity = useCallback((entity: Entity) => {
    setEditingEntity(entity);
    setIsModalOpen(true);
  }, []);

  const handleModalSave = useCallback(
    async (updatedEntity: Entity) => {
      if (onEntityUpdate) {
        onEntityUpdate(updatedEntity);
      }
      setIsModalOpen(false);
      setEditingEntity(null);
    },
    [onEntityUpdate]
  );

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setEditingEntity(null);
  }, []);

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
              <div
                onClick={() => toggleGroup(group)}
                className="flex w-full cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-background"
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
                <div className="flex items-center gap-2">
                  {onAddEntity && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isLimitReached) {
                          onAddEntity();
                        }
                      }}
                      disabled={isLimitReached}
                      title={
                        isLimitReached
                          ? `Límite de ${manualEntityLimit} campos manuales alcanzado`
                          : undefined
                      }
                      className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold transition-colors ${
                        isLimitReached
                          ? "cursor-not-allowed text-text-disabled"
                          : "text-accent hover:bg-accent/10"
                      }`}
                    >
                      <Plus className="h-3 w-3" />
                      AGREGAR CAMPO
                    </button>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5 text-text-secondary" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-text-secondary" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="divide-y divide-border border-t border-border">
                  {groupEntities
                    .filter((e) => showExcluded || !e.excluded)
                    .map((entity) => {
                      const conf = CONFIDENCE_STYLES[entity.confidence as Confidence];
                      const isExcluded = entity.excluded;
                      return (
                        <button
                          key={entity.id}
                          onClick={() => handleEditEntity(entity)}
                          className={`group flex w-full items-center justify-between p-3 text-left transition-colors hover:bg-background ${
                            isExcluded ? "opacity-50" : ""
                          }`}
                        >
                          <div className="flex flex-1 items-center gap-4">
                            <span className="w-20 text-[11px] font-medium text-text-secondary">
                              <span className={isExcluded ? "line-through" : ""}>
                                {entity.label}
                              </span>
                            </span>
                            <span className={`text-sm font-bold text-text-primary ${isExcluded ? "line-through" : ""}`}>
                              {entity.value}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {isExcluded && (
                              <span className="flex items-center gap-1 rounded border border-danger/30 bg-danger/5 px-1.5 py-0.5 text-[10px] font-bold text-danger">
                                <Ban className="h-2.5 w-2.5" />
                                Excluido
                              </span>
                            )}
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
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty group states */}
        {(Object.keys(groupedEntities) as Group[]).map((group) => {
          const groupEntities = groupedEntities[group];
          if (groupEntities.length > 0) return null;

          const config = GROUP_CONFIG[group];
          const GroupIcon = config.icon;

          return (
            <div
              key={group}
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-surface/50 p-6"
            >
              <GroupIcon className="text-3xl text-text-disabled opacity-40" />
              <p className="text-[11px] font-medium text-text-secondary">
                No se han detectado {config.label.toLowerCase()}
              </p>
              {onAddEntity && (
                <button
                  onClick={() => {
                    if (!isLimitReached) {
                      onAddEntity();
                    }
                  }}
                  disabled={isLimitReached}
                  title={
                    isLimitReached
                      ? `Límite de ${manualEntityLimit} campos manuales alcanzado`
                      : undefined
                  }
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold transition-colors ${
                    isLimitReached
                      ? "cursor-not-allowed border-border text-text-disabled"
                      : "border-accent text-accent hover:bg-accent/5"
                  }`}
                >
                  <Plus className="h-3.5 w-3.5" />
                  AGREGAR CAMPO
                </button>
              )}
            </div>
          );
        })}
      </section>

      {/* Show excluded toggle */}
      {entities.some((e) => e.excluded) && (
        <button
          onClick={() => setShowExcluded((prev) => !prev)}
          className="mx-1 text-[11px] font-medium text-accent hover:underline"
        >
          {showExcluded
            ? "Ocultar entidades excluidas"
            : `Mostrar entidades excluidas (${entities.filter((e) => e.excluded).length})`}
        </button>
      )}

      {/* Entity Edit Modal */}
      <EntityEditModal
        entity={editingEntity}
        isOpen={isModalOpen}
        onSave={handleModalSave}
        onClose={handleModalClose}
      />
    </div>
  );
}