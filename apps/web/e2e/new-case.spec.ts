import { test, expect } from "@playwright/test";
import { MOCK_ENTITIES } from "./helpers";

const TEMPLATE_ID = "f0a1b2c3-d4e5-6789-a1b2-c3d4e5f67890";
const CASE_ID = "case-123e4567-e89b-12d3-a456-426614174000";

const mockTemplate = {
  id: TEMPLATE_ID,
  name: "Contrato de prueba",
  description: "Plantilla de prueba",
  documentId: "doc-123",
  entities: MOCK_ENTITIES.slice(0, 3).map((e, i) => ({
    ...e,
    id: `ent-${i}`,
    value: "",
    userCreated: false,
  })),
  category: "Contratos",
  createdAt: "2024-05-15T00:00:00Z",
  status: "published",
};

function mockCase(formData: Record<string, string>) {
  return {
    id: CASE_ID,
    userId: 0,
    templateId: TEMPLATE_ID,
    status: "borrador",
    formData,
    generatedText: null,
    createdAt: "2024-05-15T00:00:00Z",
    updatedAt: "2024-05-15T00:00:00Z",
  };
}

test.describe("New case form", () => {
  test("fills form, saves draft, and reloads with persisted data", async ({
    page,
  }) => {
    let savedFormData: Record<string, string> = {};

    await page.route("**/api/templates/**", async (route) => {
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
          body: JSON.stringify(mockCase(savedFormData)),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/api/cases/**", async (route) => {
      if (
        route.request().method() === "PATCH" &&
        route.request().url().includes(`/api/cases/${CASE_ID}`)
      ) {
        const body = await route.request().postDataJSON();
        savedFormData = { ...savedFormData, ...(body.formData ?? {}) };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockCase(savedFormData)),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto(`/nuevo/${TEMPLATE_ID}`);

    // Wait for the form to render
    await expect(
      page.getByRole("heading", { name: mockTemplate.name })
    ).toBeVisible({ timeout: 10000 });

    // Fill the first two fields
    await page.getByLabel(/COMPRADOR/i).fill("Juan Pérez");
    await page.getByLabel(/VENDEDOR/i).fill("María López");

    // Save draft manually
    await page.getByRole("button", { name: /guardar borrador/i }).click();
    await expect(page.getByText(/borrador guardado/i)).toBeVisible({
      timeout: 10000,
    });

    // Reload the page — mocked POST now returns the saved data
    await page.reload();

    // Wait for form and assert persisted values
    await expect(page.getByLabel(/COMPRADOR/i)).toHaveValue("Juan Pérez");
    await expect(page.getByLabel(/VENDEDOR/i)).toHaveValue("María López");
  });
});
