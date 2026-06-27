"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Users, Home, Calendar, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldRenderer } from "./FieldRenderer";
import { RepeatableEntityRow } from "./RepeatableEntityRow";
import { inferFieldType } from "@/lib/case/inferFieldType";
import type { Entity } from "@template-ai/contracts";

const GROUP_ICONS: Record<Entity["group"], typeof Users> = {
  PARTES: Users,
  INMUEBLE: Home,
  FECHAS: Calendar,
  ANEXOS: Paperclip,
};

const GROUP_LABELS: Record<Entity["group"], string> = {
  PARTES: "Partes",
  INMUEBLE: "Inmueble",
  FECHAS: "Fechas",
  ANEXOS: "Anexos",
};

interface CaseFormSectionProps {
  readonly group: Entity["group"];
  readonly entities: Entity[];
  readonly values: Record<string, string>;
  readonly onChange: (entityId: string, value: string) => void;
  readonly onAddEntity?: (entity: Entity) => void;
  readonly onRemoveEntity?: (entityId: string) => void;
  readonly errors: Record<string, string>;
  readonly onBlur?: (entityId: string) => void;
}

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function CaseFormSection({
  group,
  entities,
  values,
  onChange,
  onAddEntity,
  onRemoveEntity,
  errors,
  onBlur,
}: CaseFormSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const Icon = GROUP_ICONS[group];
  const errorCount = entities.filter((entity) => errors[entity.id]).length;

  const staticEntities = entities.filter((entity) => !entity.userCreated);
  const repeatableEntities = entities.filter((entity) => entity.userCreated);

  const handleAdd = () => {
    const newEntity: Entity = {
      id: generateId(),
      label: "Parte adicional",
      value: "",
      group,
      confidence: "ALTA",
      reviewed: false,
      excluded: false,
      userCreated: true,
    };
    onAddEntity?.(newEntity);
  };

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex w-full items-center justify-between p-6 transition-colors",
          isOpen ? "bg-background" : "bg-surface hover:bg-background"
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <Icon className="h-5 w-5 text-text-disabled" />
          <span className="font-headline text-lg font-bold text-text-primary">
            {GROUP_LABELS[group]} ({entities.length})
          </span>
          {errorCount > 0 && !isOpen && (
            <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter text-warning">
              <span className="h-2 w-2 animate-pulse rounded-full bg-warning" />
              {errorCount} errores
            </span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-text-disabled" />
        ) : (
          <ChevronDown className="h-5 w-5 text-text-disabled" />
        )}
      </button>

      {isOpen && (
        <div className="space-y-8 bg-surface p-6 md:p-8">
          {staticEntities.map((entity) => (
            <FieldRenderer
              key={entity.id}
              entity={entity}
              value={values[entity.id] ?? ""}
              onChange={(value) => onChange(entity.id, value)}
              onBlur={() => onBlur?.(entity.id)}
              error={errors[entity.id]}
              fieldType={inferFieldType(entity.label)}
            />
          ))}

          {group === "PARTES" && (
            <div className="space-y-4 border-t border-dashed border-border pt-6">
              <h4 className="text-xs font-bold uppercase tracking-widest text-text-disabled">
                Firmante adicional
              </h4>
              <div className="space-y-4">
                {repeatableEntities.map((entity) => (
                  <RepeatableEntityRow
                    key={entity.id}
                    entity={entity}
                    value={values[entity.id] ?? ""}
                    onChange={(value) => onChange(entity.id, value)}
                    onRemove={() => onRemoveEntity?.(entity.id)}
                    error={errors[entity.id]}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={handleAdd}
                className="flex items-center gap-2 font-label text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                <span className="text-lg">+</span>
                Agregar parte
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
