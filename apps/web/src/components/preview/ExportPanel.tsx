"use client";

import { useState, useCallback } from "react";
import { FileText, File, Loader2 } from "lucide-react";
import { generatePdf } from "@/lib/export/pdf";
import { generateDocx } from "@/lib/export/docx";
import { buildFilename, triggerDownload, type ExportFormat } from "@/lib/export/exporters";
import { updateCase } from "@/lib/api/cases";

export interface ExportPanelProps {
  readonly caseId: string;
  readonly templateSlug: string;
  readonly generatedText: string;
  readonly onExportStart?: (format: ExportFormat) => void;
  readonly onExportComplete?: () => void;
  readonly onExportError?: (message: string) => void;
}

export function ExportPanel({
  caseId,
  templateSlug,
  generatedText,
  onExportStart,
  onExportComplete,
  onExportError,
}: ExportPanelProps) {
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExporting(format);
      setError(null);
      onExportStart?.(format);
      try {
        const filename = buildFilename(templateSlug, caseId, format);
        const blob =
          format === "pdf"
            ? generatePdf({ text: generatedText, title: templateSlug })
            : await generateDocx({ text: generatedText, title: templateSlug });

        triggerDownload(blob, filename);
        await updateCase(caseId, { status: "exportado" });
        onExportComplete?.();
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Error al exportar. Intente nuevamente.";
        setError(message);
        onExportError?.(message);
      } finally {
        setExporting(null);
      }
    },
    [caseId, generatedText, onExportComplete, onExportError, onExportStart, templateSlug]
  );

  const isExporting = exporting !== null;

  return (
    <section className="bg-white p-6 border border-stone-200 rounded-sm shadow-sm">
      <h2 className="font-headline font-bold text-stone-900 mb-4">
        Exportar documento
      </h2>

      {error && (
        <p className="mb-3 text-sm font-label text-danger" role="alert">
          {error}
        </p>
      )}

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => handleExport("pdf")}
          disabled={isExporting}
          className="w-full bg-stone-900 text-white font-label font-bold py-3 px-4 flex items-center justify-center gap-3 hover:bg-stone-800 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting === "pdf" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <FileText className="h-5 w-5" />
          )}
          Descargar PDF
        </button>
        <button
          type="button"
          onClick={() => handleExport("docx")}
          disabled={isExporting}
          className="w-full bg-white border border-stone-200 text-stone-700 font-label font-bold py-3 px-4 flex items-center justify-center gap-3 hover:bg-stone-50 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {exporting === "docx" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <File className="h-5 w-5" />
          )}
          Descargar DOCX
        </button>
      </div>
    </section>
  );
}
