"use client";

import { useCallback, useState } from "react";
import { EditableParagraph } from "./EditableParagraph";
import { splitParagraphs } from "@/lib/export/splitParagraphs";
import { updateCase } from "@/lib/api/cases";

export interface DocumentViewerProps {
  readonly caseId: string;
  readonly title: string;
  readonly generatedText: string;
  readonly onUpdate?: (text: string) => void;
}

export function DocumentViewer({
  caseId,
  title,
  generatedText,
  onUpdate,
}: DocumentViewerProps) {
  const [paragraphs, setParagraphs] = useState<string[]>(() =>
    splitParagraphs(generatedText)
  );
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = useCallback(
    async (index: number, newText: string) => {
      const nextParagraphs = paragraphs.map((paragraph, i) =>
        i === index ? newText : paragraph
      );
      const fullText = nextParagraphs.join("\n\n");

      setSavingIndex(index);
      setError(null);
      try {
        await updateCase(caseId, { formData: { generatedText: fullText } });
        setParagraphs(nextParagraphs);
        onUpdate?.(fullText);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo guardar el párrafo"
        );
      } finally {
        setSavingIndex(null);
      }
    },
    [caseId, paragraphs, onUpdate]
  );

  return (
    <div className="bg-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.05)] min-h-[1000px] p-12 md:p-20 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-stone-900" />
      <article className="max-w-prose mx-auto">
        <h1 className="font-headline text-3xl font-bold text-center mb-16 tracking-tight text-stone-900">
          {title}
        </h1>

        {error && (
          <p className="mb-6 text-sm font-label text-danger text-center">
            {error}
          </p>
        )}

        {paragraphs.map((paragraph, index) => (
          <EditableParagraph
            key={`${index}-${paragraph.slice(0, 20)}`}
            text={paragraph}
            index={index}
            onSave={handleSave}
            isSaving={savingIndex === index}
          />
        ))}

        <div className="mt-20 flex justify-between pt-16 border-t border-stone-100 italic text-stone-400 text-sm">
          <span>Firma Locador: ___________________</span>
          <span>Firma Locataria: ___________________</span>
        </div>
      </article>
    </div>
  );
}
