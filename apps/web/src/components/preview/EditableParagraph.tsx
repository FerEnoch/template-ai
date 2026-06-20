"use client";

import { useState } from "react";
import { Edit2, Check, X, Loader2 } from "lucide-react";

export interface EditableParagraphProps {
  readonly text: string;
  readonly index: number;
  readonly onSave: (index: number, newText: string) => void;
  readonly isSaving?: boolean;
}

export function EditableParagraph({
  text,
  index,
  onSave,
  isSaving = false,
}: EditableParagraphProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  const handleEdit = () => {
    setDraft(text);
    setIsEditing(true);
  };

  const handleSave = () => {
    onSave(index, draft);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(text);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <section className="relative mb-8 rounded-sm border-2 border-stone-900/10 bg-stone-50/50 p-4 -mx-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="w-full resize-none bg-transparent leading-relaxed text-justify text-stone-900 focus:outline-none"
          rows={4}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={handleCancel}
            className="border border-stone-200 px-3 py-1 text-xs font-label font-bold hover:bg-stone-100 transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="bg-stone-900 text-white px-3 py-1 text-xs font-label font-bold hover:bg-stone-800 transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Guardar
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="group relative mb-8">
      <p className="leading-relaxed text-justify text-stone-800 whitespace-pre-wrap">
        {text}
      </p>
      <button
        type="button"
        onClick={handleEdit}
        aria-label="Editar párrafo"
        className="absolute -right-8 top-0 p-1 text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-stone-900"
      >
        <Edit2 className="h-4 w-4" />
      </button>
    </section>
  );
}
