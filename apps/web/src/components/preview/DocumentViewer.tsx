"use client";

import { useCallback, useEffect, useState } from "react";
import { EditableParagraph } from "./EditableParagraph";
import { splitParagraphs } from "@/lib/export/splitParagraphs";
import { updateCase } from "@/lib/api/cases";

const BODY_TEXT_STARTERS = [
  "El presente",
  "En la ciudad",
  "Entre los",
  "Por medio de",
];

const SENTENCE_ENDING_PATTERN = /[.;:?!]$/;

export function isTitleParagraph(text: string): boolean {
  const trimmed = text.trim();

  if (trimmed.length > 100) return false;
  if (SENTENCE_ENDING_PATTERN.test(trimmed)) return false;

  const lowerTrimmed = trimmed.toLowerCase();
  if (
    BODY_TEXT_STARTERS.some((starter) =>
      lowerTrimmed.startsWith(starter.toLowerCase())
    )
  ) {
    return false;
  }

  return true;
}

export function deriveTitle(displayName: string): string {
  return displayName
    .trim()
    .split(/[-\s]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

/** Shared by preview and export so both paths use the same title contract. */
export function ensureTitleParagraphs(
  generatedText: string,
  displayName: string
): string[] {
  const paragraphs = splitParagraphs(generatedText);
  const fallbackTitle = deriveTitle(displayName);

  if (paragraphs.length === 0) {
    return [fallbackTitle];
  }

  if (!isTitleParagraph(paragraphs[0])) {
    return [fallbackTitle, ...paragraphs];
  }

  return paragraphs;
}

export function ensureTitleText(
  generatedText: string,
  displayName: string
): string {
  return ensureTitleParagraphs(generatedText, displayName).join("\n\n");
}

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
    ensureTitleParagraphs(generatedText, title)
  );

  useEffect(() => {
    setParagraphs(ensureTitleParagraphs(generatedText, title));
  }, [generatedText, title]);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync paragraphs from prop when generatedText changes externally
  // (e.g., after regeneration or page reload)
  const [propVersion, setPropVersion] = useState(generatedText);
  useEffect(() => {
    if (generatedText !== propVersion) {
      setParagraphs(splitParagraphs(generatedText));
      setPropVersion(generatedText);
    }
  }, [generatedText, propVersion]);

  const handleSave = useCallback(
    async (index: number, newText: string) => {
      const prevParagraphs = paragraphs;
      const nextParagraphs = paragraphs.map((paragraph, i) =>
        i === index ? newText : paragraph
      );
      const fullText = nextParagraphs.join("\n\n");
      const prevFullText = prevParagraphs.join("\n\n");

      setSavingIndex(index);
      setError(null);
      // Optimistically update local state and notify parent BEFORE the
      // network call so the export panel and preview reflect the edit
      // immediately. If the save fails, we revert both.
      setParagraphs(nextParagraphs);
      onUpdate?.(fullText);
      try {
        await updateCase(caseId, { generatedText: fullText });
      } catch (err) {
        setParagraphs(prevParagraphs);
        onUpdate?.(prevFullText);
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
        {error && (
          <p className="mb-6 text-sm font-label text-danger text-center">
            {error}
          </p>
        )}

        {paragraphs.map((paragraph, index) => (
          <EditableParagraph
            key={index}
            text={paragraph}
            index={index}
            onSave={handleSave}
            isSaving={savingIndex === index}
            asHeading={index === 0}
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
