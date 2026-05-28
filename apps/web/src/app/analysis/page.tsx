import {
  Check,
  Loader2,
  FileText,
  Database,
  Shield,
  Gavel,
  AlertTriangle,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";

export default function AnalysisPage() {
  return (
    <AppShell footer={false}>
      <div className="mx-auto w-full max-w-7xl p-8">
        {/* Header */}
        <header className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="mb-2 font-headline text-3xl font-bold text-text-primary">
              Analizando tu contrato
            </h1>
            <p className="font-body text-text-secondary">
              Estamos procesando el documento para identificar cláusulas,
              entidades y riesgos potenciales.
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <button className="rounded border border-border px-5 py-2 text-sm font-semibold text-text-secondary transition-colors hover:bg-background">
              Cancelar Análisis
            </button>
            <button
              disabled
              className="cursor-not-allowed rounded border border-border bg-surface px-5 py-2 text-sm font-semibold text-text-disabled"
            >
              Continuar a Revisión
            </button>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-8">
          {/* LEFT COLUMN: Stepper */}
          <section className="col-span-12 self-start rounded-xl border border-border bg-surface p-6 shadow-sm lg:col-span-3">
            <h3 className="mb-6 text-[10px] font-bold uppercase tracking-widest text-text-disabled">
              Estado del proceso
            </h3>
            <div className="relative flex flex-col gap-8">
              <div className="absolute bottom-2 left-3.5 top-2 w-px bg-border" />

              {/* Step 1 */}
              <div className="relative z-10 flex items-start gap-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-green-200 bg-green-50">
                  <Check className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Validando archivo
                  </p>
                  <p className="text-xs text-success">Completado</p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative z-10 flex items-start gap-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-green-200 bg-green-50">
                  <Check className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Extrayendo texto
                  </p>
                  <p className="text-xs text-success">Completado</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative z-10 flex items-start gap-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-blue-200 bg-blue-50">
                  <Loader2 className="h-4 w-4 animate-spin text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">
                    Detectando estructura
                  </p>
                  <p className="text-xs font-medium italic text-accent">
                    En proceso...
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="relative z-10 flex items-start gap-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background">
                  <div className="h-1.5 w-1.5 rounded-full bg-text-disabled" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-disabled">
                    Identificando datos del caso
                  </p>
                  <p className="text-xs text-text-disabled">Pendiente</p>
                </div>
              </div>
            </div>

            {/* Confidence card */}
            <div className="mt-10 rounded-lg border border-border bg-background p-4">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
                Nivel de Confianza
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">
                    ALTA: 8 campos
                  </span>
                  <div className="h-1.5 w-16 rounded-full bg-success/20">
                    <div className="h-full w-3/4 rounded-full bg-success" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-secondary">
                    BAJA: 3 campos
                  </span>
                  <div className="h-1.5 w-16 rounded-full bg-warning/20">
                    <div className="h-full w-1/4 rounded-full bg-warning" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: Previews */}
          <section className="col-span-12 grid gap-6 lg:col-span-9 lg:grid-cols-2">
            {/* Document preview skeleton */}
            <div className="flex min-h-[500px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              <div className="flex items-center gap-2 border-b border-border bg-background p-4">
                <FileText className="h-4 w-4 text-text-disabled" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-text-secondary">
                  Vista previa del documento
                </span>
              </div>
              <div className="flex-grow space-y-6 p-8">
                <div className="h-8 w-3/4 animate-pulse rounded bg-border" />
                <div className="space-y-3">
                  <div className="h-4 w-full animate-pulse rounded bg-border/50" />
                  <div className="h-4 w-full animate-pulse rounded bg-border/50" />
                  <div className="h-4 w-5/6 animate-pulse rounded bg-border/50" />
                  <div className="h-4 w-full animate-pulse rounded bg-border/50" />
                </div>
                <div className="h-48 w-full animate-pulse rounded-lg border border-dashed border-border bg-border/30" />
                <div className="space-y-3">
                  <div className="h-4 w-full animate-pulse rounded bg-border/50" />
                  <div className="h-4 w-4/6 animate-pulse rounded bg-border/50" />
                </div>
              </div>
            </div>

            {/* Entity detection skeleton */}
            <div className="flex min-h-[500px] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              <div className="flex items-center gap-2 border-b border-border bg-background p-4">
                <Database className="h-4 w-4 text-text-disabled" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-text-secondary">
                  Extracción de datos
                </span>
              </div>
              <div className="flex-grow space-y-8 p-6">
                <div className="space-y-3">
                  <div className="h-3 w-20 animate-pulse rounded bg-border" />
                  <div className="flex h-10 items-center rounded border border-border bg-background px-4">
                    <div className="h-4 w-32 animate-pulse rounded bg-border" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-3 w-24 animate-pulse rounded bg-border" />
                  <div className="flex h-10 items-center rounded border border-border bg-background px-4">
                    <div className="h-4 w-48 animate-pulse rounded bg-border" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-3 w-16 animate-pulse rounded bg-border" />
                  <div className="h-24 rounded border border-border bg-background p-4">
                    <div className="mb-2 h-3 w-full animate-pulse rounded bg-border" />
                    <div className="mb-2 h-3 w-5/6 animate-pulse rounded bg-border" />
                    <div className="h-3 w-4/6 animate-pulse rounded bg-border" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-3 w-32 animate-pulse rounded bg-border" />
                  <div className="flex h-10 items-center rounded border border-border bg-background px-4">
                    <div className="h-4 w-16 animate-pulse rounded bg-border" />
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Page footer */}
        <footer className="mt-12 flex flex-col items-center gap-4 border-t border-border pt-8">
          <p className="max-w-lg text-center font-body text-sm italic text-text-secondary">
            &ldquo;Si algo no se puede analizar con claridad, te lo decimos
            antes de continuar.&rdquo;
          </p>
          <div className="flex gap-4 opacity-50 grayscale">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Encriptación AES-256
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Gavel className="h-4 w-4" />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Cumplimiento Legal AI
              </span>
            </div>
          </div>
        </footer>
      </div>
    </AppShell>
  );
}
