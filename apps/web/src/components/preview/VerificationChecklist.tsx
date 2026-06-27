"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react";

interface CheckItem {
  id: string;
  title: string;
  detail: string;
}

const ITEMS: CheckItem[] = [
  {
    id: "structure",
    title: "Estructura",
    detail: "¿Contiene cláusulas, partes y objeto?",
  },
  { id: "data", title: "Datos", detail: "Datos completos" },
  { id: "dates", title: "Fechas", detail: "Fechas válidas" },
];

export function VerificationChecklist() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const toggleExpanded = (id: string) => {
    setExpanded((current) => (current === id ? null : id));
  };

  const toggleChecked = (id: string) => {
    setChecked((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <section className="bg-stone-50 p-6 border border-stone-200 rounded-sm">
      <h2 className="font-headline font-bold text-stone-900 mb-4 flex items-center gap-2">
        <span className="text-stone-400" aria-hidden="true">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        Verificación
      </h2>
      <ul className="space-y-4">
        {ITEMS.map((item) => {
          const isExpanded = expanded === item.id;
          const isChecked = !!checked[item.id];

          return (
            <li key={item.id} className="space-y-2">
              <button
                type="button"
                onClick={() => toggleExpanded(item.id)}
                className="flex w-full items-center justify-between text-sm font-label text-stone-600"
              >
                <span className="flex items-center gap-3">
                  <span
                    className={
                      isChecked ? "text-green-600" : "text-stone-400"
                    }
                    aria-hidden="true"
                  >
                    {isChecked ? (
                      <CheckCircle2 className="h-5 w-5 fill-current" />
                    ) : (
                      <XCircle className="h-5 w-5" />
                    )}
                  </span>
                  {item.title}
                </span>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-stone-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-stone-400" />
                )}
              </button>
              {isExpanded && (
                <label className="flex cursor-pointer items-center gap-2 pl-8 text-sm font-label text-stone-700">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleChecked(item.id)}
                    className="h-4 w-4 accent-stone-900"
                  />
                  {item.detail}
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
