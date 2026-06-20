"use client";

import { FileText, Tag, Calendar } from "lucide-react";
import type { Template } from "@template-ai/contracts";

interface CaseProgressProps {
  readonly template: Template;
  readonly filled: number;
  readonly total: number;
  readonly progress: number;
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function CaseProgress({
  template,
  filled,
  total,
  progress,
}: CaseProgressProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between">
          <span className="rounded bg-background px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            Borrador
          </span>
          <FileText className="h-5 w-5 text-text-disabled" />
        </div>

        <h1 className="font-headline text-xl font-bold leading-tight text-text-primary">
          {template.name}
        </h1>

        <div className="mt-2 space-y-1">
          <p className="flex items-center gap-2 font-label text-xs text-text-secondary">
            <Tag className="h-3.5 w-3.5" />
            {template.category}
          </p>
          <p className="flex items-center gap-2 font-label text-xs text-text-secondary">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(template.createdAt)}
          </p>
        </div>

        <div className="mt-6 border-t border-border pt-6">
          <div className="mb-2 flex justify-between font-label text-xs font-medium">
            <span className="text-text-secondary">
              Progreso: {filled} / {total} campos
            </span>
            <span className="text-text-primary">{progress}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-background">
            <div
              className="h-full bg-text-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <img
          src="https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=600&q=80"
          alt="Espacio de trabajo"
          className="h-48 w-full rounded-lg object-cover grayscale opacity-40 transition-all duration-700 hover:grayscale-0"
        />
      </div>
    </div>
  );
}
