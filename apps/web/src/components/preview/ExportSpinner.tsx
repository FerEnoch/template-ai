"use client";

import { Loader2 } from "lucide-react";

export interface ExportSpinnerProps {
  readonly format?: "pdf" | "docx";
}

export function ExportSpinner({ format }: ExportSpinnerProps) {
  const label = format ? `Exportando ${format.toUpperCase()}...` : "Preparando tu descarga";

  return (
    <div className="w-full bg-amber-50 border-b border-amber-100 px-6 py-4 flex flex-col items-center justify-center gap-2">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 text-amber-600 animate-spin" />
        <h3 className="font-headline font-medium text-stone-900">{label}</h3>
      </div>
      <p className="text-stone-500 text-sm font-label">
        Estamos generando tu archivo. Esto puede tardar unos segundos.
      </p>
      <div className="w-full max-w-md h-1 bg-stone-200 rounded-full mt-2 overflow-hidden">
        <div
          className="h-full w-1/3 rounded-full animate-shimmer"
          style={{
            background:
              "linear-gradient(90deg, transparent, #f59e0b, transparent)",
            backgroundSize: "200% 100%",
          }}
        />
      </div>
    </div>
  );
}
