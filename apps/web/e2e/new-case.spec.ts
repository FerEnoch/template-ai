import { test, expect, type Page } from "@playwright/test";
import { MOCK_ENTITIES } from "./helpers";

const TEMPLATE_ID = "f0a1b2c3-d4e5-6789-a1b2-c3d4e5f67890";
const CASE_ID = "case-123e4567-e89b-12d3-a456-426614174000";
const GENERATED_TEXT =
  "Entre el COMPRADOR Juan Pérez y la VENDEDORA María López se celebra el presente contrato.\n\nPrimera — Objeto: se transfiere el inmueble descrito.\n\nSegunda — Precio: el precio de venta se fija en la suma convenida.";

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

const mockCase = (overrides: {
  formData?: Record<string, string>;
  status?: string;
  generatedText?: string | null;
} = {}) => {
  return {
    id: CASE_ID,
    userId: 0,
    templateId: TEMPLATE_ID,
    status: overrides.status ?? "borrador",
    formData: overrides.formData ?? {},
    generatedText: overrides.generatedText ?? null,
    createdAt: "2024-05-15T00:00:00Z",
    updatedAt: "2024-05-15T00:00:00Z",
  };
};

function setupNewCaseRoutes(page: Page) {
  let savedFormData: Record<string, string> = {};
  let caseStatus = "borrador";

  page.route("**/api/templates/**", async (route) => {
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

  page.route("**/api/cases", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify(mockCase({ formData: savedFormData })),
      });
    } else {
      await route.continue();
    }
  });

  page.route("**/api/cases/**", async (route) => {
    const url = route.request().url();
    const isCurrentCase = url.includes(`/api/cases/${CASE_ID}`);

    if (!isCurrentCase) {
      await route.continue();
      return;
    }

    if (url.includes("/generate") && route.request().method() === "POST") {
      caseStatus = "generado";
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          mockCase({
            formData: savedFormData,
            status: "generado",
            generatedText: GENERATED_TEXT,
          })
        ),
      });
      return;
    }

    if (route.request().method() === "PATCH") {
      const body = await route.request().postDataJSON();
      savedFormData = { ...savedFormData, ...(body.formData ?? {}) };
      if (body.status) {
        caseStatus = body.status;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...mockCase({
            formData: savedFormData,
            status: caseStatus,
            generatedText:
              caseStatus === "generado" || caseStatus === "exportado"
                ? GENERATED_TEXT
                : null,
          }),
          template: mockTemplate,
        }),
      });
    } else if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...mockCase({
            formData: savedFormData,
            status: caseStatus,
            generatedText:
              caseStatus === "generado" || caseStatus === "exportado"
                ? GENERATED_TEXT
                : null,
          }),
          template: mockTemplate,
        }),
      });
    } else {
      await route.continue();
    }
  });
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
          body: JSON.stringify(mockCase({ formData: savedFormData })),
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
          body: JSON.stringify(mockCase({ formData: savedFormData })),
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

  test("fills form, generates, previews, and exports PDF and DOCX", async ({
    page,
  }) => {
    setupNewCaseRoutes(page);

    await page.goto(`/nuevo/${TEMPLATE_ID}`);

    await expect(
      page.getByRole("heading", { name: mockTemplate.name })
    ).toBeVisible({ timeout: 10000 });

    // Fill all fields to reach 100% progress
    await page.getByLabel(/COMPRADOR/i).fill("Juan Pérez");
    await page.getByLabel(/VENDEDOR/i).fill("María López");
    await page.getByLabel(/INMUEBLE/i).fill("Av. Siempre Viva 123");

    // Generate document
    await page.getByRole("button", { name: /generar documento/i }).click();

    // Wait for navigation to preview page
    await expect(page).toHaveURL(`/preview/${CASE_ID}`, { timeout: 10000 });

    // Preview renders the generated text
    await expect(page.getByText("Entre el COMPRADOR Juan Pérez")).toBeVisible({
      timeout: 10000,
    });

    // Export PDF
    const [pdfDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /descargar pdf/i }).click(),
    ]);
    expect(pdfDownload.suggestedFilename()).toMatch(/contrato-de-prueba-.*\.pdf/);

    // Wait for the status PATCH to complete and refresh the case data
    await expect(page.getByText(/exportado/i)).toBeVisible({ timeout: 10000 });

    // Export DOCX
    const [docxDownload] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /descargar docx/i }).click(),
    ]);
    expect(docxDownload.suggestedFilename()).toMatch(
      /contrato-de-prueba-.*\.docx/
    );
  });
});
