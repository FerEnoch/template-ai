"use client";

import { useEffect, useState } from "react";
import { http, HttpResponse, delay } from "msw";
import type { AnalysisResult, Document, Entity, Template } from "@template-ai/contracts";
import {
  SAMPLE_DOCUMENT,
  SAMPLE_ENTITIES,
} from "@/mocks/fixtures";

let storedDocument: Document = { ...SAMPLE_DOCUMENT };
let storedAnalysisResult: AnalysisResult = {
  documentId: SAMPLE_DOCUMENT.id,
  status: "processing",
  entities: [] as Entity[],
  progress: 0,
  startedAt: new Date().toISOString(),
};
let storedEntities: Entity[] = SAMPLE_ENTITIES.map((e) => ({ ...e }));
let analysisProgressTimer = 0;

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
        const { setupWorker } = await import("msw/browser");

        const handlers = [
          http.post("/api/documents/upload", async () => {
            await delay(1000 + Math.random() * 1000);
            const newDocument: Document = {
              id: crypto.randomUUID(),
              filename: "contrato-compraventa-inmueble.pdf",
              mimeType: "application/pdf",
              sizeBytes: 2_457_344,
              status: "processing",
              uploadedAt: new Date().toISOString(),
            };
            storedDocument = newDocument;
            analysisProgressTimer = 0;
            storedAnalysisResult = {
              documentId: newDocument.id,
              status: "processing",
              entities: [],
              progress: 0,
              startedAt: new Date().toISOString(),
            };
            return HttpResponse.json(newDocument, { status: 200 });
          }),

          http.get("/api/analysis/:id", ({ params }) => {
            const { id } = params;
            if (storedAnalysisResult.status === "processing") {
              analysisProgressTimer += 1;
              const newProgress = Math.min(analysisProgressTimer * 25, 100);
              const newStatus = newProgress >= 100 ? "completed" : "processing";
              storedAnalysisResult = {
                ...storedAnalysisResult,
                documentId: id as string,
                status: newStatus,
                progress: newProgress,
                entities: newStatus === "completed" ? storedEntities : [],
                completedAt: newStatus === "completed" ? new Date().toISOString() : undefined,
              };
            }
            return HttpResponse.json(storedAnalysisResult, { status: 200 });
          }),

          http.get("/api/analysis/:id/status", ({ params }) => {
            const { id } = params;
            if (storedAnalysisResult.status === "processing") {
              analysisProgressTimer += 1;
              const newProgress = Math.min(analysisProgressTimer * 25, 100);
              const newStatus = newProgress >= 100 ? "completed" : "processing";
              storedAnalysisResult = {
                ...storedAnalysisResult,
                documentId: id as string,
                status: newStatus,
                progress: newProgress,
                entities: newStatus === "completed" ? storedEntities : [],
                completedAt: newStatus === "completed" ? new Date().toISOString() : undefined,
              };
            }
            return HttpResponse.json(
              { documentId: id, status: storedAnalysisResult.status, progress: storedAnalysisResult.progress },
              { status: 200 }
            );
          }),

          http.post("/api/review/:documentId/entities/:entityId", async ({ params, request }) => {
            await delay(500);
            const { entityId } = params;
            const body = (await request.json()) as Partial<Entity>;
            const entityIndex = storedEntities.findIndex((e) => e.id === entityId);
            if (entityIndex === -1) {
              return HttpResponse.json({ error: "Entity not found" }, { status: 404 });
            }
            storedEntities[entityIndex] = { ...storedEntities[entityIndex], ...body, id: entityId as string };
            return HttpResponse.json(storedEntities[entityIndex], { status: 200 });
          }),

          http.post("/api/templates", async ({ request }) => {
            await delay(200);
            const body = (await request.json()) as Omit<Template, "id" | "createdAt">;
            if (!body.name || body.name.length < 3) {
              return HttpResponse.json({ error: "Template name must be at least 3 characters" }, { status: 400 });
            }
            if (!body.documentId) {
              return HttpResponse.json({ error: "documentId is required" }, { status: 400 });
            }
            const newTemplate: Template = { ...body, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
            return HttpResponse.json(newTemplate, { status: 201 });
          }),
        ];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const worker = setupWorker(...(handlers as any));
        await worker.start({ onUnhandledRequest: "bypass", quiet: true });

        if (!cancelled) {
          setMswReady(true);
        }
      } catch {
        if (!cancelled) {
          console.warn("[MSW] Failed to initialize mock service worker");
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