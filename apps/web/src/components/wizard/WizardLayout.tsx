"use client";

import type { ReactNode } from "react";
import { StepIndicator } from "./StepIndicator";
import { useWizard } from "@/lib/wizard";
import { WizardStep, WIZARD_STEP_ORDER } from "@/lib/wizard";

interface WizardLayoutProps {
  children: ReactNode;
}

export function WizardLayout({ children }: WizardLayoutProps) {
  const { currentStep, setStep } = useWizard();

  const steps = Object.values(WizardStep);
  const currentStepIndex = steps.indexOf(currentStep);
  const stepNumber = currentStepIndex + 1;

  const handleStepClick = (step: WizardStep) => {
    const clickedIndex = WIZARD_STEP_ORDER.indexOf(step);
    const currentIndex = WIZARD_STEP_ORDER.indexOf(currentStep);
    // Only allow navigation to completed steps (going backward)
    if (clickedIndex < currentIndex) {
      setStep(step);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Step indicator — shared across all wizard pages */}
      <div className="sticky top-14 z-30 border-b border-border bg-surface/95 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-4">
          <StepIndicator
            currentStep={currentStep}
            stepNumber={stepNumber}
            totalSteps={4}
            onStepClick={handleStepClick}
          />
        </div>
      </div>

      {/* Page content */}
      <div className="flex-1">{children}</div>
    </div>
  );
}