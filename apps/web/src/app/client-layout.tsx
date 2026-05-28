"use client";

import { Suspense, type ReactNode } from "react";
import { MswProvider } from "@/components/msw-provider";
import { WizardProvider } from "@/lib/wizard";

interface ProvidersProps {
  children: ReactNode;
}

function ClientProviders({ children }: ProvidersProps) {
  return (
    <MswProvider>
      <WizardProvider>{children}</WizardProvider>
    </MswProvider>
  );
}

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ClientProviders>{children}</ClientProviders>
    </Suspense>
  );
}