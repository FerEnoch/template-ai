import { http, HttpResponse, delay } from "msw";
import type { Document, AnalysisResult, Entity, Template } from "@template-ai/contracts";
import {
  SAMPLE_DOCUMENT,
  SAMPLE_ENTITIES,
  SAMPLE_TEMPLATES,
} from "./fixtures";

// ---------------------------------------------------------------------------
// In-memory state for simulating server-side mutable state
// ---------------------------------------------------------------------------

// Clone to avoid fixture mutation
let storedDocument: Document = { ...SAMPLE_DOCUMENT };
let storedAnalysisResult: AnalysisResult = {
  documentId: SAMPLE_DOCUMENT.id,
  status: "processing",
  entities: [] as Entity[],
  progress: 0,
  startedAt: new Date().toISOString(),
};
let storedEntities: Entity[] = SAMPLE_ENTITIES.map((e) => ({ ...e }));
let storedTemplates: Template[] = SAMPLE_TEMPLATES.map((t) => ({
  ...t,
  entities: t.entities.map((e) => ({ ...e })),
}));
let analysisProgressTimer = 0;

// ---------------------------------------------------------------------------
// Error trigger helpers
// ---------------------------------------------------------------------------

/** Check for x-mock-error header to simulate error scenarios */
function getMockError(request: Request): string | null {
  return request.headers.get("x-mock-error");
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const handlers = [
  /**
   * POST /api/documents/upload
   * Simulates a 1-2s upload with progress. Returns the document in
   * "processing" state to immediately kick off the analysis polling.
   *
   * Error trigger: x-mock-error: upload-500 → returns 500
   */
  http.post("/api/documents/upload", async ({ request }) => {
    // Check for error scenario
    const mockError = getMockError(request);
    if (mockError === "upload-500") {
      return HttpResponse.json(
        { error: "Internal server error during file upload" },
        { status: 500 }
      );
    }

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

    // Reset analysis state for the new document
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

  /**
   * GET /api/analysis/:id
   * Returns the current analysis result. Simulates 3-5s of processing with
   * progressive progress (0→100) and entity reveal.
   *
   * Error trigger: x-mock-error: analysis-failed → returns status: "failed"
   */
  http.get("/api/analysis/:id", ({ params, request }) => {
    const { id } = params;

    // Check for error scenario
    const mockError = getMockError(request);
    if (mockError === "analysis-failed") {
      return HttpResponse.json(
        {
          documentId: id as string,
          status: "failed",
          entities: [],
          progress: 0,
          startedAt: storedAnalysisResult.startedAt,
        },
        { status: 200 }
      );
    }

    // First call starts the simulated processing
    if (storedAnalysisResult.status === "processing") {
      analysisProgressTimer += 1;

      // Progress increments by 20-25 per call, simulating real work
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

  /**
   * GET /api/analysis/:id/status
   * Lightweight endpoint for polling. Returns just the status + progress.
   */
  http.get("/api/analysis/:id/status", ({ params, request }) => {
    const { id } = params;

    // Check for error scenario
    const mockError = getMockError(request);
    if (mockError === "analysis-failed") {
      return HttpResponse.json(
        {
          documentId: id,
          status: "failed",
          progress: 0,
        },
        { status: 200 }
      );
    }

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
   * Updates the reviewed flag, value, and excluded status of an entity.
   * 500ms simulated latency.
   */
  http.post(
    "/api/review/:documentId/entities/:entityId",
    async ({ params, request }) => {
      await delay(500);

      const { entityId } = params;
      const body = (await request.json()) as Record<string, unknown>;
      const entityIndex = storedEntities.findIndex((e) => e.id === entityId);

      if (entityIndex === -1) {
        return HttpResponse.json(
          { error: "Entity not found" },
          { status: 404 }
        );
      }

      // Merge update into stored entity
      storedEntities[entityIndex] = {
        ...storedEntities[entityIndex],
        ...body,
        id: entityId as string, // preserve original ID
      };

      return HttpResponse.json(storedEntities[entityIndex], { status: 200 });
    }
  ),

  /**
   * GET /api/templates
   * Returns all saved templates from in-memory state.
   */
  http.get("/api/templates", () => {
    return HttpResponse.json(storedTemplates, { status: 200 });
  }),

  /**
   * GET /api/templates/:id
   * Returns a single template by id from in-memory state.
   * Returns 404 if not found.
   */
  http.get("/api/templates/:id", ({ params }) => {
    const { id } = params;
    const template = storedTemplates.find((t) => t.id === id);

    if (!template) {
      return HttpResponse.json(
        { error: `Template with id "${id}" not found` },
        { status: 404 }
      );
    }

    return HttpResponse.json(template, { status: 200 });
  }),

  /**
   * POST /api/templates
   * Saves a template. 200ms latency. Returns the created template with a
   * generated UUID and timestamp.
   *
   * Error trigger: x-mock-error: save-409 → returns 409 conflict
   */
  http.post("/api/templates", async ({ request }) => {
    // Check for error scenario
    const mockError = getMockError(request);
    if (mockError === "save-409") {
      return HttpResponse.json(
        { error: "A template with this name already exists" },
        { status: 409 }
      );
    }

    await delay(200);

    const body = (await request.json()) as Omit<Template, "id" | "createdAt">;

    // Basic validation
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

    storedTemplates.push(newTemplate);

    return HttpResponse.json(newTemplate, { status: 201 });
  }),
];