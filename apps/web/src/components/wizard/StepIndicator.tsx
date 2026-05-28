"use client";

import { Check } from "lucide-react";
import { WizardStep } from "@/lib/wizard";

interface StepIndicatorProps {
  currentStep: WizardStep;
  stepNumber: number;
  totalSteps: number;
  onStepClick?: (step: WizardStep) => void;
}

const STEP_LABELS: Record<WizardStep, string> = {
  [WizardStep.UPLOAD]: "Configuración",
  [WizardStep.ANALYSIS]: "Análisis",
  [WizardStep.REVIEW]: "Revisión",
  [WizardStep.SAVE]: "Guardar",
};

export function StepIndicator({ currentStep, stepNumber, totalSteps, onStepClick }: StepIndicatorProps) {
  const steps = Object.values(WizardStep);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 font-label text-xs uppercase tracking-widest text-text-secondary">
        <span>
          Paso {stepNumber} de {totalSteps}
        </span>
        <span className="h-px w-8 bg-border" />
        <span className="text-text-disabled">{STEP_LABELS[currentStep]}</span>
      </div>
      <div className="flex items-center gap-3">
        {steps.map((step, idx) => {
          const stepNum = idx + 1;
          const isCompleted = stepNum < stepNumber;
          const isCurrent = stepNum === stepNumber;
          const isPending = stepNum > stepNumber;
          const isClickable = onStepClick != null && isCompleted;

          return (
            <div key={step} className="flex items-center gap-3">
              {/* Step bubble */}
              <div
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onClick={isClickable ? () => onStepClick(step) : undefined}
                onKeyDown={
                  isClickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onStepClick(step);
                        }
                      }
                    : undefined
                }
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                  isCompleted
                    ? "bg-success text-white"
                    : isCurrent
                    ? "bg-accent text-white"
                    : "border border-border bg-background text-text-disabled"
                } ${
                  isClickable
                    ? "cursor-pointer hover:ring-2 hover:ring-success/40 hover:ring-offset-1 active:scale-95"
                    : ""
                }`}
              >
                {isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  stepNum
                )}
              </div>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className={`h-px w-6 transition-all ${
                    isCompleted ? "bg-success" : "bg-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}