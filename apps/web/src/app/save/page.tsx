import {
  FileText,
  Tag,
  Calendar,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";

export default function SavePage() {
  return (
    <AppShell sidebar={false}>
      <div className="flex flex-1 flex-col bg-background p-6 md:flex-row md:gap-8">
        {/* LEFT RAIL (25%) */}
        <aside className="space-y-6 md:w-1/4">
          <div className="rounded-lg border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-start justify-between">
              <span className="rounded bg-neutral/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-neutral">
                BORRADOR
              </span>
              <FileText className="text-lg text-text-disabled" />
            </div>
            <h1 className="mb-2 font-headline text-xl font-bold leading-tight text-text-primary">
              Contrato de locación
            </h1>
            <div className="mb-6 space-y-1">
              <p className="flex items-center gap-2 font-label text-xs text-text-secondary">
                <Tag className="h-3.5 w-3.5" />
                Arrendamiento Urbano
              </p>
              <p className="flex items-center gap-2 font-label text-xs text-text-secondary">
                <Calendar className="h-3.5 w-3.5" />
                2024-05-15
              </p>
            </div>
            <div className="border-t border-border pt-6">
              <div className="mb-2 flex justify-between font-label text-xs font-medium">
                <span className="text-text-secondary">
                  Progreso: 8 / 11 campos
                </span>
                <span className="text-text-primary">72%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full w-[72%] rounded-full bg-accent transition-all duration-500"
                />
              </div>
            </div>
          </div>
          <div className="hidden md:block">
            <div className="h-48 w-full overflow-hidden rounded-lg">
              <div className="h-full w-full bg-gradient-to-br from-border/40 to-border/20 grayscale" />
            </div>
          </div>
        </aside>

        {/* MAIN FORM (75%) */}
        <section className="pb-36 md:w-3/4">
          <div className="mx-auto max-w-3xl space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="font-headline text-3xl font-bold text-text-primary">
                Guardar plantilla
              </h2>
              <div className="flex items-center gap-2 rounded-full border border-success/10 bg-success/10 px-3 py-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="text-xs font-bold uppercase tracking-wider text-success">
                  VALIDADA
                </span>
              </div>
            </div>
            <p className="font-body text-lg text-text-secondary">
              La estructura fue verificada y está lista para usar. Define los
              detalles finales para guardarla en tu biblioteca personal.
            </p>

            {/* Resumen de Importación */}
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <h3 className="mb-4 font-label text-xs font-bold uppercase tracking-widest text-text-disabled">
                Resumen de Importación
              </h3>
              <div className="grid gap-6 md:grid-cols-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-text-disabled" />
                  <div>
                    <p className="font-label text-xs uppercase text-text-disabled">
                      Archivo origen
                    </p>
                    <p className="break-all text-sm font-semibold text-text-primary">
                      CONTRATO_ARRENDAMIENTO_V2.pdf
                    </p>
                  </div>
                </div>
                <div>
                  <p className="font-label text-xs uppercase text-text-disabled">
                    Estructura
                  </p>
                  <p className="text-sm font-semibold text-text-primary">
                    11 campos totales
                  </p>
                </div>
                <div>
                  <p className="font-label text-xs uppercase text-text-disabled">
                    Estado
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-text-primary">
                      3 campos revisados
                    </p>
                    <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-accent">
                      REVISIÓN COMPLETADA
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Form */}
            <div className="space-y-6 rounded-xl border border-border bg-surface p-8 shadow-sm">
              <div className="space-y-2">
                <label className="font-label text-sm font-semibold text-text-primary">
                  Nombre de la plantilla <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  defaultValue="Contrato de Arrendamiento"
                  className="w-full rounded-lg border border-border p-3 font-body text-text-primary outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent"
                />
              </div>
              <div className="space-y-2">
                <label className="font-label text-sm font-semibold text-text-primary">
                  Descripción breve
                </label>
                <textarea
                  rows={4}
                  defaultValue="Modelo base para contratos de alquiler de vivienda"
                  className="w-full resize-none rounded-lg border border-border p-3 font-body text-text-primary outline-none transition-all focus:border-accent focus:ring-1 focus:ring-accent"
                />
                <p className="text-xs italic text-text-secondary">
                  Visible solo para ti y tu equipo.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Fixed bottom bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/95 px-8 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-4">
          <button className="rounded border border-border px-8 py-3 font-label text-sm font-semibold text-text-secondary transition-colors hover:bg-background">
            Seguir editando
          </button>
          <button className="rounded bg-accent px-8 py-3 font-label text-sm font-bold text-white shadow-lg shadow-accent/20 transition-colors hover:bg-accent-hover">
            Guardar en mi biblioteca
          </button>
        </div>
      </footer>
    </AppShell>
  );
}
