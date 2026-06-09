import { test, expect } from "@playwright/test";
import {
  MOCK_DOCUMENT,
  MOCK_ANALYSIS_COMPLETED,
  MOCK_ENTITIES,
  MOCK_DOCUMENT_ID,
} from "./helpers";

/**
 * E2E tests for error scenarios in the wizard.
 *
 * All error responses are mocked directly via page.route().fulfill()
 * — no MSW or x-mock-error headers needed. Each test explicitly mocks
 * the API endpoints it needs, returning error HTTP responses directly.
 */

test.describe("Upload failure", () => {
  test("shows not-processable screen when upload returns 400", async ({ page }) => {
    // Mock the upload endpoint to return 400 (file not processable)
    await page.route("**/api/documents/upload", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "File could not be processed" }),
      });
    });

    await page.goto("/upload?step=upload");

    // Upload a file
    const fileInput = page.locator("#file-input");
    await fileInput.setInputFiles({
      name: "contrato-escaneado.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("fake-pdf-content"),
    });
    await expect(page.getByText("Listo")).toBeVisible({ timeout: 10000 });

    // Click "Continuar al análisis"
    await page.getByRole("button", { name: /continuar al análisis/i }).click();

    await expect(page).toHaveURL(/\/analysis/);

    // Verify the not-processable error screen renders with correct content
    await expect(
      page.getByRole("heading", { name: /no pudimos analizar este archivo/i })
    ).toBeVisible({ timeout: 15000 });

    // Verify subtitle
    await expect(
      page.getByText(/dificultades técnicas/i)
    ).toBeVisible();

    // Verify "Motivos posibles" section with bullet points
    await expect(
      page.getByText(/imagen escaneada/i)
    ).toBeVisible();
    await expect(
      page.getByText(/resolución es demasiado baja/i)
    ).toBeVisible();
    await expect(
      page.getByText(/no se reconoce la estructura/i)
    ).toBeVisible();

    // Verify action buttons
    await expect(
      page.getByRole("button", { name: /subir otro archivo/i })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /reintentar con este archivo/i })
    ).toBeVisible();

    // Verify "Volver al inicio" link
    await expect(
      page.getByRole("button", { name: /volver al inicio/i })
    ).toBeVisible();
  });

  test("shows error when upload returns 500", async ({ page }) => {
    // Mock the upload endpoint to return 500
    await page.route("**/api/documents/upload", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Internal server error during file upload" }),
      });
    });

    await page.goto("/upload?step=upload");

    // Upload a file
    const fileInput = page.locator("#file-input");
    await fileInput.setInputFiles({
      name: "contrato-test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("fake-pdf-content"),
    });
    await expect(page.getByText("Listo")).toBeVisible({ timeout: 10000 });

    // Click "Continuar al análisis" — this triggers upload + analysis
    await page.getByRole("button", { name: /continuar al análisis/i }).click();

    // The analysis page should show an error
    await expect(page).toHaveURL(/\/analysis/);

    // Wait for error message to appear
    await expect(page.getByText(/error/i)).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Analysis failure", () => {
  test("shows failure state when analysis returns status:failed", async ({
    page,
  }) => {
    // Mock upload to succeed
    await page.route("**/api/documents/upload", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_DOCUMENT),
      });
    });

    // Mock analysis to return "failed" status
    await page.route("**/api/analysis/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          documentId: MOCK_DOCUMENT_ID,
          status: "failed",
          entities: [],
          progress: 0,
          startedAt: new Date().toISOString(),
        }),
      });
    });

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

    // Should see the failure message
    await expect(page.getByText(/falló/i)).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Save conflict (409)", () => {
  test("shows conflict error when saving a duplicate template name", async ({
    page,
  }) => {
    // Mock upload to succeed
    await page.route("**/api/documents/upload", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_DOCUMENT),
      });
    });

    // Mock analysis to return completed
    await page.route("**/api/analysis/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ANALYSIS_COMPLETED),
      });
    });

    // Mock review updates to succeed
    await page.route("**/api/review/**/entities/**", async (route) => {
      const body = await route.request().postDataJSON();
      const url = new URL(route.request().url());
      const entityId = url.pathname.split("/").pop() || "";
      const original = MOCK_ENTITIES.find((e) => e.id === entityId);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ...original, ...body, id: entityId }),
      });
    });

    // Mock templates: GET returns empty, POST returns 409 conflict
    await page.route("**/api/templates", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ error: "Ya existe una plantilla con ese nombre" }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      }
    });

    // Navigate through the full wizard to save step
    await page.goto("/upload?step=upload");

    const fileInput = page.locator("#file-input");
    await fileInput.setInputFiles({
      name: "contrato-test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("fake-pdf-content"),
    });
    await expect(page.getByText("Listo")).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: /continuar al análisis/i }).click();

    await expect(
      page.getByRole("heading", { name: /análisis completado/i })
    ).toBeVisible({ timeout: 30000 });
    await page
      .getByRole("button", { name: /continuar a revisión/i })
      .click();

    // Mark BAJA entities as reviewed — use while loop for robust
    // clicking since React re-renders after each click
    await expect(page).toHaveURL(/\/review/);
    while (
      await page
        .locator('[class*="border-warning"] button:has-text("Revisar")')
        .count()
        .then((c) => c > 0)
    ) {
      await page
        .locator('[class*="border-warning"] button:has-text("Revisar")')
        .first()
        .click();
    }

    await page.getByRole("button", { name: /confirmar estructura/i }).click();
    await expect(page).toHaveURL(/\/save/);

    // Fill save form
    await page.getByLabel(/nombre de la plantilla/i).fill("Nombre Duplicado");
    await page.getByLabel(/categoría/i).selectOption("Contratos");

    // Submit
    await page.getByRole("button", { name: /guardar en mi biblioteca/i }).click();

    // Should show conflict error message
    await expect(
      page.getByText(/ya existe/i)
    ).toBeVisible({ timeout: 10000 });
  });
});