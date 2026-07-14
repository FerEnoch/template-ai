"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

interface SuggestedGroupChipsProps {
  groups: string[];
  onApprove?: (group: string) => void | Promise<void>;
  onReject?: (group: string) => void | Promise<void>;
}

export function SuggestedGroupChips({
  groups,
  onApprove,
  onReject,
}: SuggestedGroupChipsProps) {
  const [actingGroup, setActingGroup] = useState<string | null>(null);

  if (groups.length === 0) return null;

  const handleApprove = async (group: string) => {
    if (!onApprove || actingGroup) return;
    setActingGroup(group);
    try {
      await onApprove(group);
    } finally {
      setActingGroup(null);
    }
  };

  const handleReject = async (group: string) => {
    if (!onReject || actingGroup) return;
    setActingGroup(group);
    try {
      await onReject(group);
    } finally {
      setActingGroup(null);
    }
  };

  return (
    <section className="space-y-3">
      <h4 className="ml-1 font-label text-[10px] font-bold uppercase tracking-widest text-text-secondary">
        Grupos sugeridos por IA
      </h4>
      <div className="flex flex-wrap gap-2">
        {groups.map((group) => {
          const isActing = actingGroup === group;
          return (
            <div
              key={group}
              className="inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent"
            >
              <span>{group}</span>
              <div className="ml-1 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => handleApprove(group)}
                  disabled={isActing}
                  aria-label={`Aprobar grupo ${group}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20 text-success transition-colors hover:bg-success/30 disabled:opacity-50"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(group)}
                  disabled={isActing}
                  aria-label={`Rechazar grupo ${group}`}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-danger/20 text-danger transition-colors hover:bg-danger/30 disabled:opacity-50"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
