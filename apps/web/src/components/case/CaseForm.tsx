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
  const { state, dispatch, updateField, addEntity, removeEntity } = useCase();
  const { template, entities, formData, caseName, nameError } = state;

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
    const trimmedName = (caseName ?? "").trim();
    if (trimmedName.length < 3) {
      dispatch({ type: "SET_NAME_ERROR", payload: "Mínimo 3 caracteres" });
      return;
    }
    dispatch({ type: "SET_NAME_ERROR", payload: null });
    onSubmit?.();
  });

  const formErrors = Object.fromEntries(
    Object.entries(errors).map(([id, error]) => [id, error?.message ?? ""])
  );

  return (
    <form onSubmit={submitHandler} className="bg-surface shadow-sm">
      <div className="grid items-start gap-4 border-b border-border p-6 md:grid-cols-4">
        <label
          htmlFor="case-name"
          className="font-label text-sm font-semibold text-text-primary md:col-span-1"
        >
          Nombre del documento <span className="text-danger">*</span>
        </label>
        <div className="md:col-span-2">
          <input
            id="case-name"
            type="text"
            value={caseName ?? template?.name ?? ""}
            onChange={(e) => {
              dispatch({ type: "SET_CASE_NAME", payload: e.target.value });
              if (nameError) {
                dispatch({ type: "SET_NAME_ERROR", payload: null });
              }
            }}
            className="w-full rounded border border-border bg-surface p-3 font-body text-sm text-text-primary focus:border-text-primary focus:outline-none"
            placeholder="Ej: Contrato Alquiler Depto A"
          />
          {nameError && (
            <p className="mt-2 flex items-center gap-1 text-xs font-medium text-danger">
              <span aria-hidden>!</span>
              {nameError}
            </p>
          )}
        </div>
      </div>
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
