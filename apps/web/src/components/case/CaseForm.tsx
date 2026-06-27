"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CaseFormSection } from "./CaseFormSection";
import { groupEntities } from "@/lib/case/groupEntities";
import { useCase } from "@/lib/case/CaseContext";
import type { Entity } from "@template-ai/contracts";

function buildSchema(entities: Entity[]) {
  const shape: Record<string, z.ZodString> = {};
  for (const entity of entities) {
    shape[entity.id] = z.string().min(1, "Este campo es obligatorio");
  }
  return z.object(shape);
}

export type CaseFormValues = Record<string, string>;

interface CaseFormProps {
  readonly onSubmit?: () => void;
}

export function CaseForm({ onSubmit }: CaseFormProps) {
  const { state, updateField, addEntity, removeEntity } = useCase();
  const { entities, formData } = state;

  const schema = buildSchema(entities);
  const {
    setValue,
    reset,
    trigger,
    formState: { errors },
    handleSubmit,
  } = useForm<CaseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: formData,
    mode: "onBlur",
  });

  useEffect(() => {
    reset(formData);
  }, [formData, reset]);

  const grouped = groupEntities(entities);

  const handleFieldChange = (entityId: string, value: string) => {
    setValue(entityId, value, { shouldValidate: false });
    updateField(entityId, value);
  };

  const handleFieldBlur = async (entityId: string) => {
    await trigger(entityId);
  };

  const submitHandler = handleSubmit(() => {
    onSubmit?.();
  });

  const formErrors = Object.fromEntries(
    Object.entries(errors).map(([id, error]) => [id, error?.message ?? ""])
  );

  return (
    <form onSubmit={submitHandler} className="bg-surface shadow-sm">
      {grouped.map(([group, groupEntities]) =>
        groupEntities.length === 0 ? null : (
          <CaseFormSection
            key={group}
            group={group}
            entities={groupEntities}
            values={formData}
            onChange={handleFieldChange}
            onAddEntity={addEntity}
            onRemoveEntity={removeEntity}
            errors={formErrors}
            onBlur={handleFieldBlur}
          />
        )
      )}
    </form>
  );
}
