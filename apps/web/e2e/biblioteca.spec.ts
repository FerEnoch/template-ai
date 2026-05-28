import { test, expect } from "@playwright/test";
import { MOCK_TEMPLATES } from "./helpers";

/**
 * E2E tests for the Biblioteca (library) page.
 *
 * API calls are mocked via Playwright's page.route().fulfill()
 * — no MSW needed. Each test controls its own mock data.
 */

test.describe("Biblioteca page — with templates", () => {
  test("displays template cards with name, category, and date", async ({
    page,
  }) => {
    // Mock GET /api/templates to return mock templates
    await page.route("**/api/templates", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_TEMPLATES),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/biblioteca");

    // Wait for page to load — the heading should be visible
    await expect(
      page.getByRole("heading", { name: /mi biblioteca/i })
    ).toBeVisible();

    // Template cards should appear after loading
    const cards = page.locator("button.group");
    await expect(cards.first()).toBeVisible({ timeout: 10000 });

    // First card should have at least a name, category, and date
    const firstCard = cards.first();
    await expect(firstCard.getByText("Contrato de compraventa - CDMX")).toBeVisible();
    // Use exact match — "Contratos" appears in both category badge and description
    await expect(firstCard.getByText("Contratos", { exact: true })).toBeVisible();
    // Date format is "27 may 2026" style (es-AR locale)
    await expect(firstCard.locator("[class*='lucide-calendar']")).toBeVisible();
  });

  test("navigate from home to biblioteca via sidebar", async ({ page }) => {
    // Mock GET /api/templates for the biblioteca page
    await page.route("**/api/templates", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_TEMPLATES),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/");

    // Click "Biblioteca" in sidebar
    await page.getByRole("link", { name: /biblioteca/i }).click();

    // Should navigate to /biblioteca
    await expect(page).toHaveURL(/\/biblioteca/);
    await expect(
      page.getByRole("heading", { name: /mi biblioteca/i })
    ).toBeVisible();
  });

  test("navigate back to home via sidebar", async ({ page }) => {
    // Mock GET /api/templates for the biblioteca page
    await page.route("**/api/templates", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_TEMPLATES),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/biblioteca");

    await expect(
      page.getByRole("heading", { name: /mi biblioteca/i })
    ).toBeVisible();

    // Click "Inicio" in sidebar to go back home
    await page.getByRole("link", { name: /^inicio$/i }).click();

    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", {
        name: /convertí documentos legales en plantillas reutilizables/i,
      })
    ).toBeVisible();
  });
});

test.describe("Biblioteca page — empty state", () => {
  test("shows empty state when no templates exist", async ({ page }) => {
    // Intercept GET /api/templates and return empty array
    await page.route("**/api/templates", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/biblioteca");

    // Should show empty state message
    await expect(
      page.getByRole("heading", { name: /no hay plantillas guardadas/i })
    ).toBeVisible({ timeout: 10000 });

    // Should show CTA link to upload
    await expect(
      page.getByRole("link", { name: /crear nueva plantilla/i })
    ).toBeVisible();

    // Click CTA — should navigate to upload page
    await page.getByRole("link", { name: /crear nueva plantilla/i }).click();
    await expect(page).toHaveURL(/\/upload\?step=upload/);
  });
});

test.describe("Biblioteca page — error state", () => {
  test("shows error state when API fails", async ({ page }) => {
    // Intercept GET /api/templates and return 500
    await page.route("**/api/templates", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Internal Server Error" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/biblioteca");

    // Should show error state with retry button
    await expect(
      page.getByRole("heading", { name: /error al cargar las plantillas/i })
    ).toBeVisible({ timeout: 10000 });

    // Should show "Reintentar" button
    await expect(
      page.getByRole("button", { name: /reintentar/i })
    ).toBeVisible();
  });
});