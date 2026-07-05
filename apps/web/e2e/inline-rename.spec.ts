import { test, expect } from "@playwright/test";
import { MOCK_TEMPLATES } from "./helpers";

const MOCK_CASES = [
  {
    id: "c0a1b2c3-d4e5-6789-a1b2-c3d4e5f67890",
    userId: 0,
    templateId: MOCK_TEMPLATES[0].id,
    status: "borrador",
    name: null,
    formData: {},
    generatedText: null,
    createdAt: "2026-05-27T11:00:00.000Z",
    updatedAt: "2026-05-27T11:00:00.000Z",
  },
];

function isListTemplates(route: { request: () => { method: () => string; url: () => string } }) {
  return (
    route.request().method() === "GET" &&
    route.request().url().endsWith("/api/templates")
  );
}

function isPatchTemplate(route: { request: () => { method: () => string; url: () => string } }) {
  return (
    route.request().method() === "PATCH" &&
    route.request().url().includes("/api/templates/")
  );
}

function isListCases(route: { request: () => { method: () => string; url: () => string } }) {
  return (
    route.request().method() === "GET" &&
    route.request().url().endsWith("/api/cases")
  );
}

function isPatchCase(route: { request: () => { method: () => string; url: () => string } }) {
  return (
    route.request().method() === "PATCH" &&
    route.request().url().includes("/api/cases/")
  );
}

test.describe("Inline rename on /biblioteca", () => {
  test("renames a template inline", async ({ page }) => {
    await page.route("**/api/templates**", async (route) => {
      if (isListTemplates(route)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_TEMPLATES),
        });
      } else if (isPatchTemplate(route)) {
        const body = await route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...MOCK_TEMPLATES[0], name: body.name }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/cases**", async (route) => {
      if (isListCases(route)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_CASES),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/biblioteca");

    const trigger = page.getByTestId("editable-name-trigger").first();
    await expect(trigger).toHaveText(MOCK_TEMPLATES[0].name);
    await trigger.click();

    const input = page.getByTestId("editable-name-input").first();
    await input.fill("Contrato renombrado");
    await input.press("Enter");

    await expect(page.getByTestId("editable-name-trigger").first()).toHaveText(
      "Contrato renombrado",
    );
  });

  test("renames a generated document inline", async ({ page }) => {
    await page.route("**/api/templates**", async (route) => {
      if (isListTemplates(route)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_TEMPLATES),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/cases**", async (route) => {
      if (isListCases(route)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_CASES),
        });
      } else if (isPatchCase(route)) {
        const body = await route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...MOCK_CASES[0], name: body.name }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/biblioteca");

    // Wait for both lists to finish loading before interacting.
    await expect(page.getByTestId("editable-name-trigger").first()).toBeVisible({
      timeout: 10000,
    });
    await expect(
      page.getByRole("heading", { name: /documentos generados/i }),
    ).toBeVisible({ timeout: 10000 });

    // The first three triggers belong to the three template cards; cases follow.
    const caseTrigger = page.getByTestId("editable-name-trigger").nth(3);
    await expect(caseTrigger).toHaveText(MOCK_TEMPLATES[0].name, {
      timeout: 10000,
    });
    await caseTrigger.click();

    // Wait for the single editable input that appears after clicking the case.
    const input = page.getByTestId("editable-name-input");
    await expect(input).toHaveCount(1, { timeout: 10000 });
    await input.fill("Documento renombrado");
    await input.press("Enter");

    await expect(caseTrigger).toHaveText("Documento renombrado");
  });

  test("cancels rename on Escape", async ({ page }) => {
    await page.route("**/api/templates**", async (route) => {
      if (isListTemplates(route)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_TEMPLATES),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/cases**", async (route) => {
      if (isListCases(route)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_CASES),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/biblioteca");

    const trigger = page.getByTestId("editable-name-trigger").first();
    const originalName = MOCK_TEMPLATES[0].name;
    await expect(trigger).toHaveText(originalName);
    await trigger.click();

    const input = page.getByTestId("editable-name-input").first();
    await input.fill("Nombre cancelado");
    await input.press("Escape");

    await expect(page.getByTestId("editable-name-trigger").first()).toHaveText(
      originalName,
    );
  });

  test("rolls back template name on 409 conflict", async ({ page }) => {
    await page.route("**/api/templates**", async (route) => {
      if (isListTemplates(route)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_TEMPLATES),
        });
      } else if (isPatchTemplate(route)) {
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            error:
              'Ya existe una plantilla llamada "Arrendamiento residencial". Elegí otro nombre.',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/cases**", async (route) => {
      if (isListCases(route)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_CASES),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto("/biblioteca");

    const trigger = page.getByTestId("editable-name-trigger").first();
    const originalName = MOCK_TEMPLATES[0].name;
    await expect(trigger).toHaveText(originalName);
    await trigger.click();

    const input = page.getByTestId("editable-name-input").first();
    await input.fill("Arrendamiento residencial");
    await input.press("Enter");

    await expect(page.getByTestId("editable-name-trigger").first()).toHaveText(
      originalName,
    );
  });
});
