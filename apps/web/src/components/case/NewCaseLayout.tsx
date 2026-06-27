"use client";

import { CaseProgress } from "./CaseProgress";
import { CaseForm } from "./CaseForm";
import { CaseStickyBar } from "./CaseStickyBar";
import { useCase } from "@/lib/case/CaseContext";

interface NewCaseLayoutProps {
  readonly onSave: () => void;
  readonly onGenerate: () => void;
}

export function NewCaseLayout({ onSave, onGenerate }: NewCaseLayoutProps) {
  const { state } = useCase();
  const { template, entities, formData, progress, saveStatus } = state;

  const filled = entities.filter(
    (entity) => (formData[entity.id] ?? "").trim() !== ""
  ).length;
  const total = entities.length;

  if (!template) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col gap-6 bg-background p-4 md:flex-row md:p-6">
      <aside className="md:w-1/4">
        <CaseProgress
          template={template}
          filled={filled}
          total={total}
          progress={progress}
        />
      </aside>

      <section className="md:w-3/4 md:pb-24">
        <CaseForm />
      </section>

      <CaseStickyBar
        progress={progress}
        filled={filled}
        total={total}
        status={saveStatus === "saving" ? "saving" : saveStatus === "saved" ? "saved" : "idle"}
        onSave={onSave}
        onGenerate={onGenerate}
      />
    </div>
  );
}
