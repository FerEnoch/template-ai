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
        body: JSON.stringify([mockCase()]),
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
        body: JSON.stringify({ ...mockCase(), template: mockTemplate }),
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
          body: JSON.stringify({ error: "No se pudo guardar el nombre" }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...mockCase({ name: body.name }),
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
  test("hover reveals icon, rename persists, and reload keeps the new name", async ({ page }) => {
    let savedName: string | null = null;

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
          body: JSON.stringify([mockCase({ name: savedName })]),
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
            ...mockCase({ name: savedName }),
            template: mockTemplate,
          }),
        });
        return;
      }
      if (route.request().method() === "PATCH") {
        const body = await route.request().postDataJSON();
        savedName = body.name;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ...mockCase({ name: body.name }),
            template: mockTemplate,
          }),
        });
        return;
      }
      await route.continue();
    });

    await page.goto(`/preview/${CASE_ID}`);

    const wrapper = page.getByTestId("editable-title-wrapper").first();
    const icon = page.getByTestId("editable-title-icon").first();

    await expect(wrapper).toHaveText(mockTemplate.name);
    await wrapper.hover();
    await expect(icon).toBeVisible();
    await icon.click();

    const input = page.getByTestId("editable-title-input").first();
    await expect(input).toHaveValue(mockTemplate.name);
    await input.fill("Título Modificado");
    await input.press("Enter");

    await expect(
      page.getByRole("heading", { name: "Título Modificado" })
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Título Modificado" })
    ).toBeVisible();
  });

  test("rapid re-edit aborts the first PATCH request", async ({ page }) => {
    let firstPatchReceived = false;

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
          body: JSON.stringify({ ...mockCase(), template: mockTemplate }),
        });
        return;
      }

      if (route.request().method() !== "PATCH") {
        await route.continue();
        return;
      }

      const body = await route.request().postDataJSON();

      if (body.name === "Primer Título") {
        firstPatchReceived = true;
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...mockCase({ name: body.name }),
          template: mockTemplate,
        }),
      });
    });

    await page.goto(`/preview/${CASE_ID}`);

    const wrapper = page.getByTestId("editable-title-wrapper").first();
    const icon = page.getByTestId("editable-title-icon").first();
    await wrapper.hover();
    await icon.click();

    const input = page.getByTestId("editable-title-input").first();
    await input.fill("Primer Título");
    await input.press("Enter");

    await expect.poll(() => firstPatchReceived).toBe(true);

    await icon.click();
    await input.fill("Segundo Título");
    await input.press("Enter");

    await expect(
      page.getByRole("heading", { name: "Segundo Título" })
    ).toBeVisible();
  });

  test("API error shows inline error and reverts the title", async ({ page }) => {
    await setupPreviewRoutes(page, { patchStatus: 409 });

    await page.goto(`/preview/${CASE_ID}`);

    const originalName = mockTemplate.name;
    const wrapper = page.getByTestId("editable-title-wrapper").first();
    await wrapper.hover();
    await page.getByTestId("editable-title-icon").first().click();

    const input = page.getByTestId("editable-title-input").first();
    await input.fill("Título Conflicto");
    await input.press("Enter");

    await expect(page.getByTestId("editable-title-error")).toBeVisible();
    await expect(input).toHaveValue(originalName);
  });
});
