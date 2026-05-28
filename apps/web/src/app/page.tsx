import Link from "next/link";
import { FileText, Shield, Search, ArrowRight } from "lucide-react";
import { AppShell } from "@/components/shell/app-shell";

const flowSteps = [
  {
    icon: FileText,
    title: "Subí tu documento",
    description:
      "Arrastrá un contrato, acuerdo o documento legal en PDF o DOCX. Detectamos automáticamente su estructura.",
  },
  {
    icon: Search,
    title: "Analizamos con IA",
    description:
      "Identificamos cláusulas, partes, fechas, montos y datos clave. Cada entidad recibe una puntuación de confianza.",
  },
  {
    icon: Shield,
    title: "Vos revisás y validás",
    description:
      "Revisión humana obligatoria antes de guardar. Corregí, ajustá y confirmá cada campo detectado.",
  },
] as const;

export default function Page() {
  return (
    <AppShell>
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pb-16 pt-20 text-center">
        <span className="mb-4 rounded-full bg-accent/10 px-4 py-1.5 font-label text-xs font-semibold uppercase tracking-wider text-accent">
          Automatización Legal
        </span>
        <h1 className="mb-4 max-w-3xl font-headline text-4xl font-bold leading-tight text-text-primary md:text-5xl">
          Convertí documentos legales en plantillas reutilizables
        </h1>
        <p className="mb-10 max-w-xl font-body text-lg leading-relaxed text-text-secondary">
          Template AI analiza tus contratos, extrae la estructura y te permite
          guardar plantillas listas para reutilizar. Con validación humana
          obligatoria en cada paso.
        </p>

        <Link
          href="/upload?step=upload"
          className="group inline-flex items-center gap-2 rounded-lg bg-accent px-8 py-3.5 font-label font-semibold text-white shadow-lg shadow-accent/10 transition-all duration-200 hover:bg-accent-hover hover:shadow-accent/20 active:translate-y-0"
        >
          Crear nueva plantilla
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </section>

      {/* Flow steps */}
      <section className="border-t border-border px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-center font-headline text-2xl font-bold text-text-primary">
            Cómo funciona
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {flowSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="relative rounded-xl border border-border bg-surface p-6 text-center"
                >
                  <span className="absolute -left-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-accent font-label text-xs font-bold text-white">
                    {index + 1}
                  </span>
                  <Icon className="mx-auto mb-4 h-8 w-8 text-accent" />
                  <h3 className="mb-2 font-headline text-lg font-semibold text-text-primary">
                    {step.title}
                  </h3>
                  <p className="font-body text-sm leading-relaxed text-text-secondary">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </AppShell>
  );
}
