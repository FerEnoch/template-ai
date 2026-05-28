import { expect, type Page, type Route } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shared mock data matching @template-ai/contracts schemas
// ---------------------------------------------------------------------------

export const MOCK_DOCUMENT_ID = "550e8400-e29b-41d4-a716-446655440000";

export const MOCK_ENTITIES = [
  {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    label: "COMPRADOR",
    value: "María González López",
    group: "PARTES",
    confidence: "ALTA",
    sourceSpan: { start: 142, end: 163 },
    reviewed: false,
    excluded: false,
  },
  {
    id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    label: "VENDEDOR",
    value: "Carlos Rodríguez Pérez",
    group: "PARTES",
    confidence: "ALTA",
    sourceSpan: { start: 165, end: 186 },
    reviewed: false,
    excluded: false,
  },
  {
    id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    label: "INMUEBLE",
    value: "Departamento en Av. Reforma 1234, Piso 8, Col. Juárez, CDMX",
    group: "INMUEBLE",
    confidence: "ALTA",
    sourceSpan: { start: 220, end: 285 },
    reviewed: false,
    excluded: false,
  },
  {
    id: "d4e5f6a7-b8c9-0123-defa-234567890123",
    label: "PRECIO_TOTAL",
    value: "$3,450,000.00 MXN",
    group: "INMUEBLE",
    confidence: "MEDIA",
    sourceSpan: { start: 310, end: 325 },
    reviewed: false,
    excluded: false,
  },
  {
    id: "e5f6a7b8-c9d0-1234-efab-345678901234",
    label: "FECHA_FIRMA",
    value: "15 de junio de 2026",
    group: "FECHAS",
    confidence: "ALTA",
    sourceSpan: { start: 400, end: 420 },
    reviewed: false,
    excluded: false,
  },
  {
    id: "f6a7b8c9-d0e1-2345-fabc-456789012345",
    label: "ESCRITURA_NUMERO",
    value: "4,218",
    group: "ANEXOS",
    confidence: "BAJA",
    sourceSpan: { start: 445, end: 450 },
    reviewed: false,
    excluded: false,
  },
  {
    id: "a7b8c9d0-e1f2-3456-abcd-567890123456",
    label: "NOTARIO",
    value: "Lic. Patricia Hernández Vega",
    group: "ANEXOS",
    confidence: "ALTA",
    sourceSpan: { start: 470, end: 498 },
    reviewed: false,
    excluded: false,
  },
  {
    id: "b8c9d0e1-f2a3-4567-bcde-678901234567",
    label: "METODO_PAGO",
    value: "Transferencia bancaria por $1,725,000 y cheque de caja por $1,725,000",
    group: "INMUEBLE",
    confidence: "MEDIA",
    sourceSpan: { start: 520, end: 595 },
    reviewed: false,
    excluded: false,
  },
  {
    id: "c9d0e1f2-a3b4-5678-cdef-789012345678",
    label: "ANTICIPO",
    value: "$345,000.00 MXN (10%)",
    group: "INMUEBLE",
    confidence: "ALTA",
    sourceSpan: { start: 600, end: 622 },
    reviewed: false,
    excluded: false,
  },
  {
    id: "d0e1f2a3-b4c5-6789-defa-890123456789",
    label: "PLAZO_CIERRE",
    value: "30 días hábiles contados a partir de la firma del presente contrato",
    group: "FECHAS",
    confidence: "MEDIA",
    sourceSpan: { start: 650, end: 720 },
    reviewed: false,
    excluded: false,
  },
  {
    id: "e1f2a3b4-c5d6-7890-efab-901234567890",
    label: "CONDICION_ESPECIAL",
    value: "El vendedor entrega el inmueble libre de gravámenes y deudas de servicios",
    group: "INMUEBLE",
    confidence: "BAJA",
    sourceSpan: { start: 740, end: 810 },
    reviewed: false,
    excluded: false,
  },
];

export const MOCK_DOCUMENT = {
  id: MOCK_DOCUMENT_ID,
  filename: "contrato-compraventa-inmueble.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2_457_344,
  status: "processing",
  uploadedAt: new Date().toISOString(),
};

export const MOCK_ANALYSIS_COMPLETED = {
  documentId: MOCK_DOCUMENT_ID,
  status: "completed",
  entities: MOCK_ENTITIES,
  progress: 100,
  startedAt: new Date().toISOString(),
  completedAt: new Date().toISOString(),
};

export const MOCK_TEMPLATES = [
  {
    id: "f0a1b2c3-d4e5-6789-a1b2-c3d4e5f67890",
    name: "Contrato de compraventa - CDMX",
    description:
      "Plantilla estándar para contratos de compraventa de inmuebles en la Ciudad de México.",
    documentId: MOCK_DOCUMENT_ID,
    entities: MOCK_ENTITIES,
    category: "Contratos",
    createdAt: "2026-05-27T11:00:00.000Z",
    status: "published",
  },
  {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567901",
    name: "Arrendamiento residencial",
    description:
      "Contrato de arrendamiento para inmuebles residenciales con cláusulas de depósito en garantía y mantenimiento.",
    documentId: "660e8400-e29b-41d4-a716-446655440001",
    entities: MOCK_ENTITIES.filter((e) =>
      ["PARTES", "INMUEBLE", "FECHAS"].includes(e.group)
    ),
    category: "Arrendamiento",
    createdAt: "2026-05-20T09:30:00.000Z",
    status: "published",
  },
  {
    id: "b2c3d4e5-f6a7-8901-bcde-f1234567902",
    name: "Donación inmobiliaria",
    description:
      "Contrato de donación de bienes inmuebles entre particulares con cláusulas de aceptación y registro.",
    documentId: "770e8400-e29b-41d4-a716-446655440002",
    entities: MOCK_ENTITIES.filter((e) =>
      ["PARTES", "INMUEBLE"].includes(e.group)
    ),
    category: "Donaciones",
    createdAt: "2026-05-15T14:20:00.000Z",
    status: "draft",
  },
];

// ---------------------------------------------------------------------------
// Route setup helpers — mock API responses via Playwright page.route()
// These replace MSW handlers for E2E tests, providing deterministic,
// isolated mock data without needing the real backend or MSW service worker.
// ---------------------------------------------------------------------------

/** Fulfill a route with a JSON response */
function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

/**
 * Mock POST /api/documents/upload — returns a document in "processing" state.
 * The analysis page then polls GET /api/analysis/:id.
 */
export async function mockUpload(route: Route) {
  await json(route, 200, MOCK_DOCUMENT);
}

/**
 * Mock GET /api/analysis/:id — returns a completed analysis with mock entities.
 * Retries are handled naturally: each call returns completed.
 */
export async function mockAnalysisCompleted(route: Route) {
  await json(route, 200, MOCK_ANALYSIS_COMPLETED);
}

/**
 * Create a progressive analysis mock that returns "processing" for the first
 * N calls, then "completed" with entities.
 */
export function createProgressiveAnalysisMock(processingCalls: number = 2) {
  let callCount = 0;
  return async (route: Route) => {
    callCount++;
    if (callCount <= processingCalls) {
      await json(route, 200, {
        documentId: MOCK_DOCUMENT_ID,
        status: "processing",
        entities: [],
        progress: callCount * 25,
        startedAt: new Date().toISOString(),
      });
    } else {
      await json(route, 200, MOCK_ANALYSIS_COMPLETED);
    }
  };
}

/**
 * Mock POST /api/review/:documentId/entities/:entityId — returns updated entity.
 * Echoes back the request body merged with the original entity ID.
 */
export async function mockReviewUpdate(route: Route) {
  const body = await route.request().postDataJSON();
  // Extract entity ID from URL
  const url = new URL(route.request().url());
  const entityId = url.pathname.split("/").pop() || "";
  const original = MOCK_ENTITIES.find((e) => e.id === entityId);

  await json(route, 200, {
    ...original,
    ...body,
    id: entityId,
  });
}

/**
 * Mock POST /api/templates — returns created template.
 */
export async function mockCreateTemplate(route: Route) {
  const body = await route.request().postDataJSON();
  await json(route, 201, {
    ...body,
    id: "new-template-id",
    createdAt: new Date().toISOString(),
  });
}

/**
 * Mock GET /api/templates — returns mock templates.
 */
export async function mockListTemplates(route: Route) {
  await json(route, 200, MOCK_TEMPLATES);
}

/**
 * Set up all wizard API routes for a happy-path test.
 * Mocks upload, analysis, review, and template endpoints.
 */
export function setupWizardRoutes(page: Page, options?: { progressiveAnalysis?: boolean }) {
  const analysisHandler = options?.progressiveAnalysis
    ? createProgressiveAnalysisMock(2)
    : mockAnalysisCompleted;

  page.route("**/api/documents/upload", mockUpload);
  page.route("**/api/analysis/**", analysisHandler);
  page.route("**/api/review/**/entities/**", mockReviewUpdate);
  page.route("**/api/templates", async (route) => {
    if (route.request().method() === "POST") {
      await mockCreateTemplate(route);
    } else {
      await mockListTemplates(route);
    }
  });
}

/**
 * Navigate through the wizard to the analysis page and wait for completion.
 * Assumes wizard API routes are already set up.
 */
export async function navigateToAnalysis(page: Page) {
  await page.goto("/upload?step=upload");

  const fileInput = page.locator("#file-input");
  await fileInput.setInputFiles({
    name: "contrato-test.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("fake-pdf-content"),
  });

  await expect(page.getByText("Listo")).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: /continuar al análisis/i }).click();

  await expect(page).toHaveURL(/\/analysis/);
  await expect(
    page.getByRole("heading", { name: /análisis completado/i })
  ).toBeVisible({ timeout: 30000 });
}

/**
 * Navigate through the wizard to the review page.
 * Assumes wizard API routes are already set up.
 */
export async function navigateToReview(page: Page) {
  await navigateToAnalysis(page);

  await page
    .getByRole("button", { name: /continuar a revisión/i })
    .click();
  await expect(page).toHaveURL(/\/review/);
}