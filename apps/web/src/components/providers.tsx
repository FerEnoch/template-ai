"use client";

import type { ReactNode } from "react";
import { MswProvider } from "@/components/msw-provider";
import { WizardProvider } from "@/lib/wizard";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <MswProvider>
      <WizardProvider>{children}</WizardProvider>
    </MswProvider>
  );
}