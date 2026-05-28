import {
  Upload,
  FileText,
  CheckCircle2,
  Trash2,
  Info,
  AlertTriangle,
  Ruler,
  ArrowRight,
  Shield,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";

export default function UploadPage() {
  return (
    <AppShell footer={false}>
      <div className="mx-auto w-full max-w-6xl px-6 pb-36 pt-8 md:px-12">
        {/* Stepper */}
        <div className="mb-10">
          <div className="mb-2 flex items-center gap-2 font-label text-xs uppercase tracking-widest text-text-secondary">
            <span>Paso 1 de 3</span>
            <span className="h-px w-8 bg-border" />
            <span className="text-text-disabled">Configuración</span>
          </div>
          <h1 className="font-headline text-4xl font-light text-text-primary">
            Crear nueva plantilla
          </h1>
        </div>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          {/* CENTRAL: Dropzone */}
          <div className="space-y-6 lg:col-span-8">
            <div className="group relative">
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-surface p-12 text-center transition-all duration-300 hover:border-text-secondary">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-background text-text-secondary transition-transform duration-300 group-hover:scale-110">
                  <Upload className="h-8 w-8" />
                </div>
                <h3 className="mb-2 font-headline text-xl text-text-primary">
                  Arrastrá tu archivo aquí o hacé clic para buscar
                </h3>
                <p className="mx-auto mb-8 max-w-xs font-body text-text-secondary">
                  Formatos compatibles para análisis inteligente de contratos.
                </p>
                <div className="flex gap-2">
                  <span className="rounded border border-border bg-background px-2 py-1 text-[10px] font-bold uppercase text-text-secondary">
                    PDF
                  </span>
                  <span className="rounded border border-border bg-background px-2 py-1 text-[10px] font-bold uppercase text-text-secondary">
                    DOCX
                  </span>
                  <span className="rounded border border-border bg-background px-2 py-1 text-[10px] font-bold uppercase text-text-secondary">
                    JPG
                  </span>
                </div>
              </div>
            </div>

            {/* Uploaded file card */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-accent/10 text-accent">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-label text-sm font-semibold text-text-primary">
                    CONTRATO_ARRENDAMIENTO_V2.pdf
                  </p>
                  <p className="font-label text-xs text-text-secondary">
                    1.2 MB
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-bold uppercase tracking-wider text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Listo
                </span>
                <button className="flex h-8 w-8 items-center justify-center rounded-full text-text-disabled transition-colors hover:bg-danger/10 hover:text-danger">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Guidance panel */}
          <div className="lg:col-span-4">
            <div className="sticky top-24 rounded-xl border border-border bg-surface/70 p-6">
              <div className="mb-4 flex items-center gap-2 text-text-primary">
                <Info className="h-5 w-5 text-accent" />
                <h2 className="font-headline text-lg font-semibold">
                  Recomendaciones para mejores resultados
                </h2>
              </div>
              <ul className="mb-8 space-y-4">
                <li className="flex gap-3 text-sm leading-relaxed text-text-secondary">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-text-disabled" />
                  <span>
                    Usá archivos con <strong>texto seleccionable</strong> para
                    un análisis preciso.
                  </span>
                </li>
                <li className="flex gap-3 text-sm leading-relaxed text-text-secondary">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-text-disabled" />
                  <span>
                    Evitá documentos escaneados de baja calidad o rotados.
                  </span>
                </li>
                <li className="flex gap-3 text-sm leading-relaxed text-text-secondary">
                  <Ruler className="mt-0.5 h-4 w-4 shrink-0 text-text-disabled" />
                  <span>
                    El tamaño máximo permitido por archivo es{" "}
                    <strong>25 MB</strong>.
                  </span>
                </li>
              </ul>
              <div className="border-t border-border pt-6">
                <a
                  href="#"
                  className="group flex items-center justify-between font-label text-xs text-text-secondary transition-colors hover:text-text-primary"
                >
                  Cómo tratamos tus documentos
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed bottom bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-surface/90 backdrop-blur-md md:ml-60">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-3 text-text-secondary">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background">
              <Shield className="h-4 w-4" />
            </div>
            <p className="font-label text-sm">
              Vas a revisar todo lo que detectamos antes de guardar.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button className="rounded-lg px-6 py-2 font-label font-medium text-text-secondary transition-colors hover:bg-background">
              Cancelar
            </button>
            <button className="rounded-lg bg-accent px-8 py-2.5 font-label font-semibold text-white shadow-lg shadow-accent/10 transition-all duration-200 hover:bg-accent-hover active:translate-y-0">
              Continuar al análisis
            </button>
          </div>
        </div>
      </footer>
    </AppShell>
  );
}
