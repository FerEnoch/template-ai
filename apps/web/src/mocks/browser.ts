import { isMockEnabled } from "./index";
import { http, HttpResponse, delay } from "msw";
import type { AnalysisResult, Document, Entity, Template } from "@template-ai/contracts";
import {
  SAMPLE_DOCUMENT,
  SAMPLE_ENTITIES,
} from "./fixtures";

// ---------------------------------------------------------------------------
// In-memory state for simulating server-side mutable state
// ---------------------------------------------------------------------------

// Clone to avoid fixture mutation
let storedDocument: Document = { ...SAMPLE_DOCUMENT };
let storedAnalysisResult: AnalysisResult = {
  documentId: SAMPLE_DOCUMENT.id,
  status: "processing",
  entities: [],
  progress: 0,
  startedAt: new Date().toISOString(),
  extractedText: null,
};
let storedEntities: Entity[] = SAMPLE_ENTITIES.map((e) => ({ ...e }));
let analysisProgressTimer = 0;

// ---------------------------------------------------------------------------
// MSW browser entry — only initialise when NEXT_PUBLIC_MSW=true.
// Called from app/layout.tsx in a useEffect to avoid SSR issues.
// ---------------------------------------------------------------------------

export async function initMsw() {
  if (!isMockEnabled()) {
    return;
  }

  const { setupWorker } = await import("msw/browser");

  // ---------------------------------------------------------------------------
  // All handlers defined inline to ensure consistent module resolution.
  // ---------------------------------------------------------------------------

  const handlers = [
    /**
     * POST /api/documents/upload
     * Simulates 1-2s upload, returns document in "processing" state.
     */
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
        extractedText: null,
      };

      return HttpResponse.json(newDocument, { status: 200 });
    }),

    /**
     * GET /api/analysis/:id
     * Returns the current analysis result. Simulates 3-5s processing with
     * progressive progress (0→100) and entity reveal.
     */
    http.get("/api/analysis/:id", ({ params }) => {
      const { id } = params;

      if (storedAnalysisResult.status === "processing") {
        analysisProgressTimer += 1;
        const newProgress = Math.min(analysisProgressTimer * 25, 100);

        if (newProgress >= 100) {
          storedAnalysisResult = {
            ...storedAnalysisResult,
            documentId: id as string,
            status: "analyzing",
            progress: newProgress,
            entities: [],
          };
        } else {
          storedAnalysisResult = {
            ...storedAnalysisResult,
            documentId: id as string,
            status: "processing",
            progress: newProgress,
            entities: [],
          };
        }
      } else if (storedAnalysisResult.status === "analyzing") {
        storedAnalysisResult = {
          ...storedAnalysisResult,
          status: "completed",
          entities: storedEntities,
          completedAt: new Date().toISOString(),
        };
      }

      return HttpResponse.json(storedAnalysisResult, { status: 200 });
    }),

    /**
     * GET /api/analysis/:id/status
     * Lightweight endpoint for polling. Returns just status + progress.
     */
    http.get("/api/analysis/:id/status", ({ params }) => {
      const { id } = params;

      if (storedAnalysisResult.status === "processing") {
        analysisProgressTimer += 1;
        const newProgress = Math.min(analysisProgressTimer * 25, 100);

        if (newProgress >= 100) {
          storedAnalysisResult = {
            ...storedAnalysisResult,
            documentId: id as string,
            status: "analyzing",
            progress: newProgress,
            entities: [],
          };
        } else {
          storedAnalysisResult = {
            ...storedAnalysisResult,
            documentId: id as string,
            status: "processing",
            progress: newProgress,
            entities: [],
          };
        }
      } else if (storedAnalysisResult.status === "analyzing") {
        storedAnalysisResult = {
          ...storedAnalysisResult,
          status: "completed",
          entities: storedEntities,
          completedAt: new Date().toISOString(),
        };
      }

      return HttpResponse.json(
        {
          documentId: id,
          status: storedAnalysisResult.status,
          progress: storedAnalysisResult.progress,
        },
        { status: 200 }
      );
    }),

    /**
     * POST /api/review/:documentId/entities/:entityId
     * Updates entity reviewed flag / value. 500ms simulated latency.
     */
    http.post(
      "/api/review/:documentId/entities/:entityId",
      async ({ params, request }) => {
        await delay(500);
        const { entityId } = params;
        const body = (await request.json()) as Partial<Entity>;
        const entityIndex = storedEntities.findIndex((e) => e.id === entityId);

        if (entityIndex === -1) {
          return HttpResponse.json({ error: "Entity not found" }, { status: 404 });
        }

        storedEntities[entityIndex] = {
          ...storedEntities[entityIndex],
          ...body,
          id: entityId as string,
        };

        return HttpResponse.json(storedEntities[entityIndex], { status: 200 });
      }
    ),

    /**
     * POST /api/templates
     * Saves a template. 200ms latency. Returns the created template.
     */
    http.post("/api/templates", async ({ request }) => {
      await delay(200);
      const body = (await request.json()) as Omit<Template, "id" | "createdAt">;

      if (!body.name || body.name.length < 3) {
        return HttpResponse.json(
          { error: "Template name must be at least 3 characters" },
          { status: 400 }
        );
      }

      if (!body.documentId) {
        return HttpResponse.json(
          { error: "documentId is required" },
          { status: 400 }
        );
      }

      const newTemplate: Template = {
        ...body,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };

      return HttpResponse.json(newTemplate, { status: 201 });
    }),
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const worker = setupWorker(...(handlers as any));

  await worker.start({
    onUnhandledRequest: "bypass",
    quiet: true,
  });

  return worker;
}