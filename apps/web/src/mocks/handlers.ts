import { http, HttpResponse, delay } from "msw";
import type {
  Document,
  AnalysisResult,
  Entity,
  Template,
  ClassifySpanRequest,
  ClassifySpanResponse,
} from "@template-ai/contracts";
import { MANUAL_ENTITY_LIMIT } from "@template-ai/contracts";
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
  extractedText: null,
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
   * Error triggers:
   *   x-mock-error: upload-400 → returns 400 (file not processable)
   *   x-mock-error: upload-500 → returns 500 (internal server error)
   */
  http.post("/api/documents/upload", async ({ request }) => {
    // Check for error scenario
    const mockError = getMockError(request);
    if (mockError === "upload-400") {
      return HttpResponse.json(
        { error: "File could not be processed" },
        { status: 400 }
      );
    }
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
      extractedText: null,
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

      // Progress increments by 25 per call, simulating real work
      const newProgress = Math.min(analysisProgressTimer * 25, 100);

      if (newProgress >= 100) {
        // Transition to "analyzing" — AI call would happen now on the real server
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
      // Next poll: AI call "finished" — transition to completed with entities
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
   * Lightweight read-only endpoint for polling. Returns just status + progress
   * WITHOUT side effects. Progress is exclusively driven by GET /:id.
   * This prevents race conditions from duplicate AI triggers (Causa #3).
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

    // Read-only: return current status without mutating anything
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

  /**
   * POST /api/review/:documentId/entities/classify-span
   * Classifies selected text via AI and returns entity suggestion.
   * Simulates 2-3s AI processing time.
   *
   * Error triggers:
   *   x-mock-error: classify-limit-reached → returns 403 (manual entity limit reached)
   *   x-mock-error: classify-timeout → returns 408 (AI timeout)
   *   x-mock-error: classify-failed → returns 422 (classification failed)
   */
  http.post(
    "/api/review/:documentId/entities/classify-span",
    async ({ request }) => {
      const mockError = getMockError(request);

      // Check for limit reached scenario
      if (mockError === "classify-limit-reached") {
        return HttpResponse.json(
          {
            error: "Manual entity limit reached",
            code: "MANUAL_ENTITY_LIMIT_REACHED",
          },
          { status: 403 }
        );
      }

      // Check for timeout scenario
      if (mockError === "classify-timeout") {
        await delay(10000); // Simulate timeout
        return HttpResponse.json(
          {
            error: "AI classification timeout",
            code: "AI_TIMEOUT",
          },
          { status: 408 }
        );
      }

      // Check for classification failure
      if (mockError === "classify-failed") {
        return HttpResponse.json(
          {
            error: "AI classification failed",
            code: "CLASSIFICATION_FAILED",
          },
          { status: 422 }
        );
      }

      // Simulate AI processing time (2-3s)
      await delay(2000 + Math.random() * 1000);

      const body = (await request.json()) as ClassifySpanRequest;

      // Simple mock classification logic
      const response: ClassifySpanResponse = {
        label: inferLabel(body.text),
        group: inferGroup(body.text),
        value: body.text,
      };

      return HttpResponse.json(response, { status: 200 });
    }
  ),

  /**
   * POST /api/review/:documentId/entities
   * Creates a new manual entity. Validates manual entity limit.
   *
   * Error trigger: x-mock-error: create-limit-reached → returns 403
   */
  http.post("/api/review/:documentId/entities", async ({ request }) => {
    const mockError = getMockError(request);

    // Check for limit reached scenario
    if (mockError === "create-limit-reached") {
      return HttpResponse.json(
        {
          error: "Manual entity limit reached",
          code: "MANUAL_ENTITY_LIMIT_REACHED",
        },
        { status: 403 }
      );
    }

    await delay(300);

    const body = (await request.json()) as Entity;

    // Add to stored entities
    storedEntities.push(body);

    return HttpResponse.json(body, { status: 201 });
  }),

  /**
   * GET /api/review/:documentId/entities/manual-count
   * Returns the count of manual (user-created) entities for a document.
   */
  http.get("/api/review/:documentId/entities/manual-count", () => {
    const manualCount = storedEntities.filter((e) => e.userCreated).length;
    return HttpResponse.json({ count: manualCount }, { status: 200 });
  }),
];

// Helper functions for mock classification
function inferLabel(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("juan") || lower.includes("maría") || lower.includes("pérez")) {
    return "Arrendatario";
  }
  if (lower.includes("av.") || lower.includes("calle") || lower.includes("dirección")) {
    return "Dirección";
  }
  if (lower.includes("2024") || lower.includes("2023") || lower.includes("enero")) {
    return "Fecha";
  }
  return "Campo Personalizado";
}

function inferGroup(text: string): "PARTES" | "INMUEBLE" | "FECHAS" | "ANEXOS" {
  const lower = text.toLowerCase();
  if (lower.includes("juan") || lower.includes("maría") || lower.includes("pérez")) {
    return "PARTES";
  }
  if (lower.includes("av.") || lower.includes("calle") || lower.includes("dirección")) {
    return "INMUEBLE";
  }
  if (lower.includes("2024") || lower.includes("2023") || lower.includes("enero")) {
    return "FECHAS";
  }
  return "ANEXOS";
}