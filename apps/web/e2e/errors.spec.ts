import { test, expect } from "@playwright/test";

/**
 * E2E tests for error scenarios in the wizard.
 *
 * MSW handlers check `x-mock-error` header to trigger error responses.
 * Since we can't add custom headers to the app's fetch calls from outside,
 * we use Playwright's `page.route()` to intercept and inject the error headers.
 *
 * MSW processes the request after Playwright's route continuation, so the
 * `x-mock-error` header is visible to the MSW handler running in the browser
 * service worker.
 */

test.describe("Upload failure", () => {
  test("shows error when upload returns 500", async ({ page }) => {
    // Intercept POST /api/documents/upload and add error header
    await page.route("**/api/documents/upload", async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          "x-mock-error": "upload-500",
        },
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

    // Wait for error message to appear — the upload fails so analysis page shows error
    await expect(page.getByText(/error/i)).toBeVisible({ timeout: 15000 });
  });
});

test.describe("Analysis failure", () => {
  test("shows failure state when analysis returns status:failed", async ({
    page,
  }) => {
    // Intercept analysis polling and inject error header
    await page.route("**/api/analysis/**", async (route) => {
      await route.continue({
        headers: {
          ...route.request().headers(),
          "x-mock-error": "analysis-failed",
        },
      });
    });

    // We also need the upload to succeed — don't intercept that
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
    // Intercept POST /api/templates and inject 409 error header
    await page.route("**/api/templates", async (route) => {
      if (route.request().method() === "POST") {
        await route.continue({
          headers: {
            ...route.request().headers(),
            "x-mock-error": "save-409",
          },
        });
      } else {
        await route.continue();
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

    // Mark BAJA entities as reviewed
    await expect(page).toHaveURL(/\/review/);
    const reviewButtons = page.locator(
      '[class*="border-warning"] button:has-text("Revisar")'
    );
    const reviewCount = await reviewButtons.count();
    for (let i = 0; i < reviewCount; i++) {
      await reviewButtons.nth(i).click();
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