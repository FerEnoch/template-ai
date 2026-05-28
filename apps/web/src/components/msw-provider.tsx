"use client";

import { useEffect, useState } from "react";
import { setupWorker } from "msw/browser";
import { handlers } from "@/mocks/handlers";

function isMockEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MSW === "true";
}

interface MswProviderProps {
  children: React.ReactNode;
}

export function MswProvider({ children }: MswProviderProps) {
  const [mswReady, setMswReady] = useState(false);

  useEffect(() => {
    if (!isMockEnabled()) {
      setMswReady(true);
      return;
    }

    let cancelled = false;

    const setupMsw = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const worker = setupWorker(...(handlers as any));
        await worker.start({ onUnhandledRequest: "bypass", quiet: true });

        if (!cancelled) {
          setMswReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn("[MSW] Failed to initialize mock service worker:", err);
          setMswReady(true);
        }
      }
    };

    setupMsw();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!mswReady && isMockEnabled()) {
    return null;
  }

  return <>{children}</>;
}