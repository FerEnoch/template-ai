"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";

const SaveFormSchema = z.object({
  name: z
    .string()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(200, "El nombre no puede superar los 200 caracteres"),
  description: z
    .string()
    .max(1000, "La descripción no puede superar los 1000 caracteres")
    .optional()
    .or(z.literal("")),
  category: z
    .string()
    .min(1, "La categoría es obligatoria")
    .max(100, "La categoría no puede superar los 100 caracteres"),
});

// SaveFormValues: description is optional string (Zod `.optional().or("")` produces string | undefined at type level)
export type SaveFormValues = {
  name: string;
  description?: string;
  category: string;
};

interface SaveFormProps {
  onSubmit: (values: SaveFormValues) => Promise<void>;
  initialValues?: {
    name?: string;
    description?: string;
    category?: string;
  };
  isSubmitting?: boolean;
}

export function SaveForm({ onSubmit, initialValues, isSubmitting }: SaveFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SaveFormValues>({
    resolver: zodResolver(SaveFormSchema),
    defaultValues: {
      name: initialValues?.name ?? "",
      description: initialValues?.description ?? "",
      category: initialValues?.category ?? "Contratos",
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Nombre de la plantilla */}
      <div className="space-y-2">
        <label
          htmlFor="name"
          className="font-label text-sm font-semibold text-text-primary"
        >
          Nombre de la plantilla <span className="text-danger">*</span>
        </label>
        <input
          id="name"
          type="text"
          {...register("name")}
          placeholder="Ej: Contrato de compraventa - CDMX"
          className="w-full rounded-lg border border-border bg-surface p-3 font-body text-text-primary outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent"
        />
        {errors.name && (
          <p className="text-xs font-medium text-danger">{errors.name.message}</p>
        )}
      </div>

      {/* Descripción breve */}
      <div className="space-y-2">
        <label
          htmlFor="description"
          className="font-label text-sm font-semibold text-text-primary"
        >
          Descripción breve
        </label>
        <textarea
          id="description"
          rows={4}
          {...register("description")}
          placeholder="Describe brevemente el uso de esta plantilla..."
          className="w-full resize-none rounded-lg border border-border bg-surface p-3 font-body text-text-primary outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent"
        />
        {errors.description && (
          <p className="text-xs font-medium text-danger">
            {errors.description.message}
          </p>
        )}
        <p className="text-xs italic text-text-secondary">
          Visible solo para vos y tu equipo.
        </p>
      </div>

      {/* Categoría */}
      <div className="space-y-2">
        <label
          htmlFor="category"
          className="font-label text-sm font-semibold text-text-primary"
        >
          Categoría <span className="text-danger">*</span>
        </label>
        <select
          id="category"
          {...register("category")}
          className="w-full rounded-lg border border-border bg-surface p-3 font-body text-text-primary outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent"
        >
          <option value="Contratos">Contratos</option>
          <option value="Arrendamiento">Arrendamiento</option>
          <option value="Compraventa">Compraventa</option>
          <option value="Laboral">Laboral</option>
          <option value="Corporativo">Corporativo</option>
          <option value="Otro">Otro</option>
        </select>
        {errors.category && (
          <p className="text-xs font-medium text-danger">
            {errors.category.message}
          </p>
        )}
      </div>

      {/* Validación */}
      <div className="flex items-center gap-2 rounded-full border border-success/10 bg-success/10 px-3 py-1.5">
        <CheckCircle2 className="h-4 w-4 text-success" />
        <span className="text-xs font-bold uppercase tracking-wider text-success">
          VALIDADA
        </span>
      </div>

      {/* Hidden submit trigger */}
      <input type="submit" className="hidden" />
    </form>
  );
}