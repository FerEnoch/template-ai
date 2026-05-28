import {
  FileText,
  ZoomIn,
  ZoomOut,
  Printer,
  Shield,
  AlertCircle,
  Users,
  Building2,
  Calendar,
  Paperclip,
  Plus,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  AlertTriangle,
  Info,
  CheckCircle2,
} from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";

export default function ReviewPage() {
  return (
    <AppShell sidebar={false}>
      {/* Main split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Document Viewer (62%) */}
        <section className="flex w-[62%] flex-col overflow-hidden border-r border-border bg-surface">
          {/* Title bar */}
          <div className="flex items-center justify-between border-b border-border bg-surface px-6 py-3">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-accent" />
              <h2 className="font-headline text-sm font-bold text-text-primary">
                CONTRATO_ARRENDAMIENTO_V2.pdf
              </h2>
            </div>
            <div className="flex gap-1">
              <button className="rounded p-1.5 text-text-secondary transition-colors hover:bg-border">
                <ZoomIn className="h-4 w-4" />
              </button>
              <button className="rounded p-1.5 text-text-secondary transition-colors hover:bg-border">
                <ZoomOut className="h-4 w-4" />
              </button>
              <button className="rounded p-1.5 text-text-secondary transition-colors hover:bg-border">
                <Printer className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Document canvas */}
          <div className="flex flex-1 justify-center overflow-y-auto bg-background p-12">
            <article className="min-h-[1200px] w-full max-w-3xl bg-surface p-16 font-body leading-relaxed text-text-primary shadow-sm">
              <h1 className="mb-12 text-center font-headline text-xl font-bold uppercase tracking-widest">
                Contrato de Arrendamiento de Vivienda
              </h1>

              <p className="mb-6">
                En Madrid, a 15 de Octubre de 2023.
              </p>
              <p className="mb-6 font-bold">REUNIDOS</p>
              <p className="mb-6">
                De una parte, como{" "}
                <span
                  className="rounded-sm px-1"
                  style={{
                    backgroundColor: "rgba(34, 197, 94, 0.1)",
                    borderBottom: "2px solid rgba(34, 197, 94, 0.4)",
                  }}
                >
                  ARRENDADOR
                </span>
                , el Sr. Don Julián Ruiz de Azúa, mayor de edad, con DNI
                12345678X y domicilio en{" "}
                <span
                  className="rounded-sm px-1"
                  style={{
                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                    borderBottom: "2px solid rgba(245, 158, 11, 0.4)",
                  }}
                >
                  Calle Mayor 12
                </span>
                , 2º Izquierda, 28013, Madrid.
              </p>
              <p className="mb-6">
                De otra parte, como ARRENDATARIO, la Sra. Doña Elena Blanco
                Marín, con DNI 87654321Y, y con domicilio a efectos de
                notificaciones en la propia vivienda objeto del presente
                contrato.
              </p>
              <p className="mb-6 font-bold">ESTIPULACIONES</p>
              <p className="mb-6">
                <span className="font-bold">PRIMERA. Objeto.</span> El
                Arrendador cede en arrendamiento al Arrendatario la vivienda
                sita en la{" "}
                <span
                  className="rounded-sm px-1"
                  style={{
                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                    borderBottom: "2px solid rgba(245, 158, 11, 0.4)",
                  }}
                >
                  Calle Mayor 12
                </span>{" "}
                de Madrid, para ser destinada exclusivamente a vivienda
                permanente del Arrendatario y su familia.
              </p>
              <p className="mb-6">
                <span className="font-bold">SEGUNDA. Renta.</span> La renta
                mensual acordada por las partes es de{" "}
                <span
                  className="rounded-sm px-1 font-bold"
                  style={{
                    backgroundColor: "rgba(245, 158, 11, 0.1)",
                    borderBottom: "2px solid rgba(245, 158, 11, 0.4)",
                  }}
                >
                  2.500€
                </span>{" "}
                (dos mil quinientos euros), pagaderos dentro de los cinco
                primeros días de cada mes mediante transferencia bancaria.
              </p>
              <p className="mb-12">
                <span className="font-bold">TERCERA. Duración.</span> El
                presente contrato tendrá una duración de un (1) año, prorrogable
                según los plazos establecidos en la Ley de Arrendamientos
                Urbanos vigente.
              </p>

              {/* Page footer */}
              <div className="mt-20 flex justify-between border-t border-border pt-4 text-xs text-text-disabled">
                <span>Página 1 de 12</span>
                <span>template-ai legal review mode</span>
              </div>
            </article>
          </div>
        </section>

        {/* Right: Review Panel (38%) */}
        <section className="flex w-[38%] flex-col overflow-hidden bg-background">
          {/* Panel header */}
          <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6 py-4">
            <h3 className="font-headline text-lg font-bold text-text-primary">
              Entidades y datos detectados
            </h3>
            <span className="rounded bg-accent/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-accent">
              85% IA Confidence
            </span>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto p-6 custom-scrollbar">
            {/* Priority Review Section */}
            <section className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
              <div className="h-1 w-full bg-warning/20">
                <div className="h-full w-1/3 bg-warning" />
              </div>
              <div className="p-4">
                <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-warning">
                  <AlertCircle className="h-4 w-4" />
                  <span>Revisión prioritaria (2 pendientes)</span>
                </div>
                <div className="space-y-4">
                  {/* Pending item 1 */}
                  <div className="border-l-4 border-warning pl-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-label text-xs font-bold text-text-primary">
                          Renta Mensual
                        </h5>
                        <p className="my-0.5 text-sm font-bold text-text-primary">
                          2.500€
                        </p>
                        <p className="max-w-[200px] truncate text-[11px] italic text-text-secondary">
                          Ambigüedad detectada en cláusula segunda.
                        </p>
                      </div>
                      <button className="px-2 py-1 text-xs font-bold text-accent hover:underline">
                        Revisar
                      </button>
                    </div>
                  </div>
                  {/* Pending item 2 */}
                  <div className="border-l-4 border-warning pl-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h5 className="font-label text-xs font-bold text-text-primary">
                          Fecha Inicio
                        </h5>
                        <p className="my-0.5 text-sm font-bold text-text-primary">
                          15/10/2023
                        </p>
                        <p className="max-w-[200px] truncate text-[11px] italic text-text-secondary">
                          Múltiples fechas detectadas en encabezado.
                        </p>
                      </div>
                      <button className="px-2 py-1 text-xs font-bold text-accent hover:underline">
                        Revisar
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Detected Groups */}
            <section className="space-y-3">
              <h4 className="ml-1 font-label text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                Grupos detectados
              </h4>

              {/* Group: Partes (expanded) */}
              <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                <button className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-background">
                  <div className="flex items-center gap-2">
                    <Users className="text-xl text-accent" />
                    <span className="text-sm font-bold text-text-primary">
                      Partes
                    </span>
                    <span className="ml-1 rounded bg-background px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
                      3
                    </span>
                  </div>
                  <ChevronUp className="h-5 w-5 text-text-secondary" />
                </button>
                <div className="divide-y divide-border border-t border-border">
                  {/* Field: Arrendador */}
                  <div className="group flex items-center justify-between p-3">
                    <div className="flex flex-1 items-center gap-4">
                      <span className="w-20 text-[11px] font-medium text-text-secondary">
                        Arrendador
                      </span>
                      <span className="text-sm font-bold text-text-primary">
                        Julián Ruiz de Azúa
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-1 text-[10px] font-bold text-success">
                        <div className="h-1.5 w-1.5 rounded-full bg-success" />
                        <span>ALTA</span>
                      </div>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                        Con traza
                      </span>
                      <MoreVertical className="h-4 w-4 opacity-0 text-text-secondary transition-opacity group-hover:opacity-100" />
                    </div>
                  </div>
                  {/* Field: Arrendatario */}
                  <div className="group flex items-center justify-between p-3">
                    <div className="flex flex-1 items-center gap-4">
                      <span className="w-20 text-[11px] font-medium text-text-secondary">
                        Arrendatario
                      </span>
                      <span className="text-sm font-bold text-text-primary">
                        Elena Blanco Marín
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 px-1 text-[10px] font-bold text-success">
                        <div className="h-1.5 w-1.5 rounded-full bg-success" />
                        <span>ALTA</span>
                      </div>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-text-secondary">
                        Con traza
                      </span>
                      <MoreVertical className="h-4 w-4 opacity-0 text-text-secondary transition-opacity group-hover:opacity-100" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Group: Inmueble (collapsed, with warning) */}
              <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                <button className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-background">
                  <div className="relative flex items-center gap-2">
                    <Building2 className="text-xl text-accent" />
                    <span className="text-sm font-bold text-text-primary">
                      Inmueble
                    </span>
                    <span className="ml-1 rounded bg-background px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
                      1
                    </span>
                    <div className="absolute -right-1.5 -top-1.5 h-2 w-2 rounded-full border border-surface bg-warning" />
                  </div>
                  <ChevronDown className="h-5 w-5 text-text-secondary" />
                </button>
              </div>

              {/* Group: Fechas (collapsed) */}
              <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
                <button className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-background">
                  <div className="flex items-center gap-2">
                    <Calendar className="text-xl text-accent" />
                    <span className="text-sm font-bold text-text-primary">
                      Fechas
                    </span>
                    <span className="ml-1 rounded bg-background px-1.5 py-0.5 text-[10px] font-bold text-text-secondary">
                      2
                    </span>
                  </div>
                  <ChevronDown className="h-5 w-5 text-text-secondary" />
                </button>
              </div>

              {/* Group: Anexos (empty state) */}
              <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-surface/50 p-6">
                <Paperclip className="text-3xl text-text-disabled opacity-40" />
                <p className="text-[11px] font-medium text-text-secondary">
                  No se han detectado anexos
                </p>
                <button className="mt-1 rounded border border-border bg-surface px-3 py-1 text-[10px] font-bold text-text-primary transition-colors hover:bg-background">
                  + AGREGAR CAMPO
                </button>
              </div>
            </section>

            {/* Doubts section */}
            <section className="space-y-3 border-t border-border pt-4">
              <h4 className="ml-1 font-label text-[10px] font-bold uppercase tracking-widest text-text-secondary">
                Dudas del análisis
              </h4>
              <div className="space-y-2">
                <div className="rounded-lg border border-border bg-surface p-4 shadow-sm">
                  <p className="mb-3 text-xs font-medium text-text-primary">
                    ¿El arrendador actúa como persona física o jurídica?
                  </p>
                  <div className="flex gap-2">
                    <button className="flex-1 rounded border border-accent py-1.5 text-[10px] font-bold text-accent transition-colors hover:bg-accent/5">
                      FÍSICA
                    </button>
                    <button className="flex-1 rounded border border-accent py-1.5 text-[10px] font-bold text-accent transition-colors hover:bg-accent/5">
                      JURÍDICA
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <div className="h-16" />
          </div>
        </section>
      </div>

      {/* Sticky bottom action bar */}
      <footer className="flex shrink-0 items-center justify-between border-t border-border bg-surface px-8 py-3 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-3 text-text-secondary">
          <Shield className="h-5 w-5 text-accent" />
          <span className="font-label text-xs font-medium tracking-tight">
            Revisión humana obligatoria — confirmá la estructura antes de
            guardar
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button className="rounded border border-accent px-5 py-2 text-xs font-bold text-accent transition-colors hover:bg-accent/5">
            Seguir revisando
          </button>
          <div className="flex flex-col items-center">
            <button
              disabled
              className="cursor-not-allowed rounded bg-text-disabled/30 px-8 py-2 text-xs font-bold text-white"
            >
              Confirmar estructura
            </button>
            <span className="mt-1 text-[10px] font-medium text-danger">
              Quedan 1 filas con confianza BAJA por revisar
            </span>
          </div>
        </div>
      </footer>
    </AppShell>
  );
}
