import { test, expect, type Page } from "@playwright/test";
import { MOCK_TEMPLATES, MOCK_ENTITIES } from "./helpers";

const TEMPLATE_ID = MOCK_TEMPLATES[0].id;
const CASE_ID = "case-123e4567-e89b-12d3-a456-426614174000";
const GENERATED_TEXT =
  "Entre el COMPRADOR Juan Pérez y la VENDEDORA María López se celebra el presente contrato.\n\nPrimera — Objeto: se transfiere el inmueble descrito.\n\nSegunda — Precio: el precio de venta se fija en la suma convenida.";

const mockTemplate = {
  ...MOCK_TEMPLATES[0],
  entities: MOCK_ENTITIES.slice(0, 3).map((entity, index) => ({
    ...entity,
    id: `ent-${index}`,
    value: "",
    userCreated: false,
  })),
};

const mockCase = (overrides: {
  name?: string | null;
  status?: string;
  generatedText?: string | null;
} = {}) => ({
  id: CASE_ID,
  userId: 0,
  templateId: TEMPLATE_ID,
  status: overrides.status ?? "generado",
  name: overrides.name ?? null,
  formData: {},
  generatedText: overrides.generatedText ?? GENERATED_TEXT,
  createdAt: "2026-05-27T11:00:00.000Z",
  updatedAt: "2026-05-27T11:00:00.000Z",
});

async function setupPreviewRoutes(
  page: Page,
  options?: { patchDelay?: number; patchStatus?: number }
) {
  let currentName: string | null = null;
  let currentGeneratedText = GENERATED_TEXT;

  await page.route("**/api/templates**", async (route) => {
    if (route.request().url().includes(`/api/templates/${TEMPLATE_ID}`)) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockTemplate),
      });
    } else {
      await route.continue();
    }
  });

  await page.route("**/api/cases**", async (route) => {
    if (
      route.request().method() === "GET" &&
      route.request().url().endsWith("/api/cases")
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          mockCase({ name: currentName, generatedText: currentGeneratedText }),
        ]),
      });
      return;
    }
    await route.continue();
  });

  await page.route("**/api/cases/**", async (route) => {
    const url = route.request().url();
    const isCurrentCase = url.includes(`/api/cases/${CASE_ID}`);

    if (!isCurrentCase) {
      await route.continue();
      return;
    }

    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...mockCase({
            name: currentName,
            generatedText: currentGeneratedText,
          }),
          template: mockTemplate,
        }),
      });
      return;
    }

    if (route.request().method() === "PATCH") {
      const body = await route.request().postDataJSON();

      if (options?.patchDelay) {
        await new Promise((resolve) => setTimeout(resolve, options.patchDelay));
      }

      if (options?.patchStatus && options.patchStatus >= 400) {
        await route.fulfill({
          status: options.patchStatus,
          contentType: "application/json",
          body: JSON.stringify({ error: "No se pudo guardar el párrafo" }),
        });
        return;
      }

      if (typeof body.name === "string") {
        currentName = body.name;
      }
      const nextText = body.formData?.generatedText ?? body.generatedText;
      if (typeof nextText === "string") {
        currentGeneratedText = nextText;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...mockCase({
            name: currentName,
            generatedText: currentGeneratedText,
          }),
          template: mockTemplate,
        }),
      });
      return;
    }

    await route.continue();
  });
}

test.describe("Inline name editing — /biblioteca", () => {
  test("renames a template inline and the new name persists across reload", async ({ page }) => {
    let savedName = MOCK_TEMPLATES[0].name;

    await page.route("**/api/templates**", async (route) => {
      if (
        route.request().method() === "GET" &&
        route.request().url().endsWith("/api/templates")
      ) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { ...MOCK_TEMPLATES[0], name: savedName },
            ...MOCK_TEMPLATES.slice(1),
          ]),
        });
        return;
      }
      if (
        route.request().method() === "PATCH" &&
        route.request().url().includes(`/api/templates/${TEMPLATE_ID}`)
      ) {
        const body = await route.request().postDataJSON();
        savedName = body.name;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...MOCK_TEMPLATES[0], name: body.name }),
        });
        return;
      }
      await route.continue();
    });

    await page.route("**/api/cases**", async (route) => {
      if (
        route.request().method() === "GET" &&
        route.request().url().endsWith("/api/cases")
      ) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([]),
        });
        return;
      }
      await route.continue();
    });

    await page.goto("/biblioteca");

    const trigger = page.getByTestId("editable-name-trigger").first();
    await expect(trigger).toHaveText(MOCK_TEMPLATES[0].name);
    await trigger.click();

    const input = page.getByTestId("editable-name-input").first();
    await input.fill("Contrato renombrado");
    await input.press("Enter");

    await expect(page.getByTestId("editable-name-trigger").first()).toHaveText(
      "Contrato renombrado"
    );

    await page.reload();
    await expect(page.getByTestId("editable-name-trigger").first()).toHaveText(
      "Contrato renombrado"
    );
  });
});

test.describe("Inline name editing — /nuevo/[templateId]", () => {
  test("renamed case propagates through CaseContext", async ({ page }) => {
    await page.route("**/api/templates**", async (route) => {
      if (route.request().url().includes(`/api/templates/${TEMPLATE_ID}`)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockTemplate),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/cases", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(mockCase({ status: "borrador" })),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/cases/**", async (route) => {
      const url = route.request().url();
      const isCurrentCase = url.includes(`/api/cases/${CASE_ID}`);
      if (!isCurrentCase) {
        await route.continue();
        return;
      }
      if (route.request().method() === "PATCH") {
        const body = await route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockCase({ name: body.name })),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto(`/nuevo/${TEMPLATE_ID}`);

    await expect(
      page.getByRole("heading", { name: mockTemplate.name })
    ).toBeVisible({ timeout: 10000 });

    const trigger = page.getByTestId("editable-name-trigger").first();
    await expect(trigger).toHaveText(mockTemplate.name);
    await trigger.click();

    const input = page.getByTestId("editable-name-input").first();
    await input.fill("Caso Modificado");
    await input.press("Enter");

    await expect(page.getByTestId("editable-name-trigger").first()).toHaveText(
      "Caso Modificado"
    );
  });
});

test.describe("Inline name editing — /preview/[caseId]", () => {
  // Final design: filename is read-only in the banner; the document title is the
  // first content paragraph (EditableParagraph asHeading), not EditableTitle.

  test("banner shows read-only filename and first paragraph is an editable h1", async ({
    page,
  }) => {
    let savedGeneratedText = GENERATED_TEXT;

    await page.route("**/api/templates**", async (route) => {
      if (route.request().url().includes(`/api/templates/${TEMPLATE_ID}`)) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockTemplate),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/cases**", async (route) => {
      if (
        route.request().method() === "GET" &&
        route.request().url().endsWith("/api/cases")
      ) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            mockCase({
              name: "Contrato Locacion",
              generatedText: savedGeneratedText,
            }),
          ]),
        });
        return;
      }
      await route.continue();
    });

    await page.route("**/api/cases/**", async (route) => {
      const url = route.request().url();
      const isCurrentCase = url.includes(`/api/cases/${CASE_ID}`);
      if (!isCurrentCase) {
        await route.continue();
        return;
      }
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...mockCase({
              name: "Contrato Locacion",
              generatedText: savedGeneratedText,
            }),
            template: mockTemplate,
          }),
        });
        return;
      }
      if (route.request().method() === "PATCH") {
        const body = await route.request().postDataJSON();
        const nextText =
          body.formData?.generatedText ??
          body.generatedText ??
          savedGeneratedText;
        savedGeneratedText = nextText;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...mockCase({
              name: "Contrato Locacion",
              generatedText: nextText,
            }),
            template: mockTemplate,
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto(`/preview/${CASE_ID}`);

    // Filename banner is metadata, not editable.
    const banner = page.locator("div").filter({ hasText: "Documento:" }).first();
    await expect(banner.getByRole("heading", { name: "Contrato Locacion" })).toBeVisible();
    await expect(page.getByTestId("editable-title-wrapper")).toHaveCount(0);
    await expect(page.getByTestId("editable-title-icon")).toHaveCount(0);

    // Document content title lives inside the article (EditableParagraph asHeading).
    const contentHeading = page.locator("article").getByRole("heading", { level: 1 });
    await expect(contentHeading).toBeVisible({ timeout: 10000 });

    await contentHeading.hover();
    await page.getByRole("button", { name: "Editar título" }).click();

    const editor = page.locator("textarea").first();
    await expect(editor).toBeVisible();
    await editor.fill("Titulo Del Documento");
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(
      page.locator("article").getByRole("heading", { name: "Titulo Del Documento" })
    ).toBeVisible();

    // Filename banner stays unchanged after content-title edit.
    await expect(banner.getByRole("heading", { name: "Contrato Locacion" })).toBeVisible();

    await page.reload();
    await expect(
      page.locator("article").getByRole("heading", { name: "Titulo Del Documento" })
    ).toBeVisible();
  });

  test("content title edit survives cancel and can be saved again", async ({
    page,
  }) => {
    await setupPreviewRoutes(page);

    await page.goto(`/preview/${CASE_ID}`);

    const contentHeading = page.locator("article").getByRole("heading", { level: 1 });
    await expect(contentHeading).toBeVisible({ timeout: 10000 });
    const originalTitle = (await contentHeading.textContent())?.trim() ?? "";

    await contentHeading.hover();
    await page.getByRole("button", { name: "Editar título" }).click();

    const editor = page.locator("textarea").first();
    await editor.fill("Borrador Descartable");
    await page.getByRole("button", { name: "Cancelar" }).click();

    await expect(
      page.locator("article").getByRole("heading", { name: originalTitle })
    ).toBeVisible();

    await page.locator("article").getByRole("heading", { name: originalTitle }).hover();
    await page.getByRole("button", { name: "Editar título" }).click();
    await page.locator("textarea").first().fill("Titulo Guardado");
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(
      page.locator("article").getByRole("heading", { name: "Titulo Guardado" })
    ).toBeVisible();
  });

  test("API error while saving content title shows error and keeps prior text", async ({
    page,
  }) => {
    await setupPreviewRoutes(page, { patchStatus: 409 });

    await page.goto(`/preview/${CASE_ID}`);

    const contentHeading = page.locator("article").getByRole("heading", { level: 1 });
    await expect(contentHeading).toBeVisible({ timeout: 10000 });
    const originalTitle = (await contentHeading.textContent())?.trim() ?? "";

    await contentHeading.hover();
    await page.getByRole("button", { name: "Editar título" }).click();
    await page.locator("textarea").first().fill("Titulo Conflicto");
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByText("No se pudo guardar el párrafo")).toBeVisible();
    await expect(
      page.locator("article").getByRole("heading", { name: originalTitle })
    ).toBeVisible();
  });
});
