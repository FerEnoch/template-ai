"use client";

import { useState } from "react";
import { AlertTriangle, AlertCircle, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotProcessableScreenProps {
  /** The file that was attempted to upload */
  readonly file: { name: string };
  /** Called when user clicks "Reintentar con este archivo" */
  readonly onRetry: () => void;
  /** Called when user clicks "Subir otro archivo" → navigates to upload step */
  readonly onGoBack: () => void;
  /** Called when user clicks "Volver al inicio" → navigates to / */
  readonly onGoHome: () => void;
}

type LoadingAction = "retry" | "goBack" | null;

export function NotProcessableScreen({
  file: _file,
  onRetry,
  onGoBack,
  onGoHome,
}: NotProcessableScreenProps) {
  const [loading, setLoading] = useState<LoadingAction>(null);

  const handleRetry = async () => {
    setLoading("retry");
    try {
      await onRetry();
    } finally {
      setLoading(null);
    }
  };

  const handleGoBack = async () => {
    setLoading("goBack");
    try {
      await onGoBack();
    } finally {
      setLoading(null);
    }
  };

  const handleGoHome = async () => {
    setLoading("goBack");
    try {
      await onGoHome();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-start py-12 px-6">
      <div className="w-full max-w-3xl flex flex-col gap-10">
        {/* ── HEADER ── */}
        <header className="text-center">
          <div className="mb-5 inline-flex items-center justify-center w-16 h-16 rounded-full bg-warning/10 text-warning">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h1 className="font-headline text-4xl font-semibold text-text-primary mb-2">
            No pudimos analizar este archivo
          </h1>
          <p className="font-body text-lg text-text-secondary">
            El sistema encontró dificultades técnicas al procesar el documento
            legal proporcionado.
          </p>
        </header>

        {/* ── TWO-COLUMN CONTENT ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-6">
            {/* Causes card */}
            <div className="bg-surface p-6 rounded-xl border border-border shadow-sm">
              <h3 className="font-label text-sm font-bold text-text-secondary uppercase tracking-widest mb-4">
                Motivos posibles
              </h3>
              <ul className="flex flex-col gap-4">
                <li className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-neutral mt-0.5 shrink-0" />
                  <span className="text-text-primary leading-snug">
                    El texto del documento no es seleccionable (imagen escaneada)
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-neutral mt-0.5 shrink-0" />
                  <span className="text-text-primary leading-snug">
                    La resolución es demasiado baja para detectar la estructura
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-neutral mt-0.5 shrink-0" />
                  <span className="text-text-primary leading-snug">
                    No se reconoce la estructura del documento
                  </span>
                </li>
              </ul>
            </div>

            {/* Tip card */}
            <div className="bg-warning/5 p-6 rounded-xl border border-warning/20">
              <div className="flex items-center gap-2 mb-3 text-warning">
                <Lightbulb className="h-5 w-5" />
                <h3 className="font-label text-sm font-bold uppercase tracking-widest">
                  Para mejores resultados:
                </h3>
              </div>
              <p className="text-text-primary leading-relaxed italic text-sm">
                Usá documentos PDF con texto digital (no escaneado), asegurate
                de que el texto sea legible y nítido, evitá documentos
                protegidos con contraseña.
              </p>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Action panel ── */}
          <div className="bg-surface p-8 rounded-xl border border-border shadow-sm flex flex-col gap-6">
            <h3 className="font-headline text-2xl font-medium text-text-primary">
              ¿Qué podés hacer ahora?
            </h3>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleGoBack}
                disabled={loading !== null}
                className={cn(
                  "w-full bg-accent text-white py-4 px-6 rounded-lg font-label font-bold text-base transition-all",
                  "hover:bg-accent-hover hover:shadow-lg",
                  "active:scale-[0.98]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {loading === "goBack" ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Cargando...
                  </span>
                ) : (
                  "Subir otro archivo"
                )}
              </button>
              <button
                onClick={handleRetry}
                disabled={loading !== null}
                className={cn(
                  "w-full bg-white text-accent border border-accent py-4 px-6 rounded-lg font-label font-bold text-base transition-all",
                  "hover:bg-accent/5",
                  "active:scale-[0.98]",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {loading === "retry" ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                    Reintentando...
                  </span>
                ) : (
                  "Reintentar con este archivo"
                )}
              </button>
            </div>
            <div className="pt-4 border-t border-border text-center">
              <button
                onClick={handleGoHome}
                disabled={loading !== null}
                className={cn(
                  "text-text-secondary hover:text-accent underline font-label text-sm transition-colors",
                  "decoration-border underline-offset-4",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
