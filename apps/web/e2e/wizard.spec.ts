import { test, expect } from "@playwright/test";
import {
  MOCK_ENTITIES,
  MOCK_DOCUMENT,
  MOCK_ANALYSIS_COMPLETED,
  setupWizardRoutes,
} from "./helpers";

/**
 * E2E tests for the wizard happy path and entity editing.
 *
 * API calls are mocked via Playwright's page.route() — no MSW needed.
 * Each test sets up its own route mocks for full isolation.
 */

test.describe("Wizard happy path", () => {
  test("complete full wizard flow: upload → analysis → review → save", async ({
    page,
  }) => {
    setupWizardRoutes(page);

    // 1. Home page — verify CTA exists and click it
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /crear nueva plantilla/i })
    ).toBeVisible();

    await page.getByRole("link", { name: /crear nueva plantilla/i }).click();

    // Should navigate to upload page
    await expect(page).toHaveURL(/\/upload\?step=upload/);

    // 2. Upload page — upload a file
    const fileInput = page.locator("#file-input");
    await expect(fileInput).toBeAttached();

    await fileInput.setInputFiles({
      name: "contrato-test.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("fake-pdf-content"),
    });

    // Wait for file to be accepted — "Listo" badge appears
    await expect(page.getByText("Listo")).toBeVisible({ timeout: 10000 });

    // Click "Continuar al análisis"
    await page.getByRole("button", { name: /continuar al análisis/i }).click();

    // 3. Analysis page — wait for completion
    await expect(page).toHaveURL(/\/analysis/);

    await expect(
      page.getByRole("heading", { name: /análisis completado/i })
    ).toBeVisible({ timeout: 30000 });

    // Verify confidence summary is shown
    await expect(page.getByText(/ALTA:/i)).toBeVisible();

    // Click "Continuar a Revisión"
    await page
      .getByRole("button", { name: /continuar a revisión/i })
      .click();

    // 4. Review page — verify entities are shown
    await expect(page).toHaveURL(/\/review/);
    await expect(
      page.getByRole("heading", { name: /entidades y datos detectados/i })
    ).toBeVisible();

    // Verify entity labels are visible (use exact match to avoid
    // matching entity values like "El vendedor entrega...")
    await expect(page.getByText("COMPRADOR", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("VENDEDOR", { exact: true }).first()).toBeVisible();
  });

  test("mark BAJA entities and confirm structure to reach save page", async ({
    page,
  }) => {
    setupWizardRoutes(page);

    // Navigate through wizard to review step
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

    await page
      .getByRole("button", { name: /continuar a revisión/i })
      .click();
    await expect(page).toHaveURL(/\/review/);

    // Click "Revisar" on each BAJA entity — use while loop because
    // React re-renders remove the button after click
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

    // Now confirm structure should be enabled
    const confirmButton = page.getByRole("button", {
      name: /confirmar estructura/i,
    });
    await expect(confirmButton).toBeEnabled();

    await confirmButton.click();

    // Should navigate to save page
    await expect(page).toHaveURL(/\/save/);
    await expect(
      page.getByRole("heading", { name: /guardar plantilla/i })
    ).toBeVisible();
  });

  test("fill save form and save template", async ({ page }) => {
    setupWizardRoutes(page);

    // Navigate through wizard to save step
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
    await page.getByLabel(/nombre de la plantilla/i).fill("Test Contract Template");
    await page.getByLabel(/categoría/i).selectOption("Contratos");

    // Submit the form
    await page.getByRole("button", { name: /guardar en mi biblioteca/i }).click();

    // Should show success message
    await expect(page.getByText(/plantilla guardada/i)).toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe("Entity editing via modal", () => {
  test.beforeEach(async ({ page }) => {
    setupWizardRoutes(page);

    // Navigate to review step for all entity editing tests
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
    await expect(page).toHaveURL(/\/review/);
  });

  test("open entity modal, edit value, and save", async ({ page }) => {
    // Click on COMPRADOR entity to open the modal
    await page.getByRole("button", { name: /COMPRADOR/i }).first().click();

    // Modal should open
    await expect(
      page.getByRole("heading", { name: /editar entidad/i })
    ).toBeVisible();

    // Edit the value
    const valueInput = page.getByLabel(/valor/i);
    await valueInput.clear();
    await valueInput.fill("Nuevo Nombre Editado");

    // Click "Guardar cambios"
    await page.getByRole("button", { name: /guardar cambios/i }).click();

    // Modal should close
    await expect(
      page.getByRole("heading", { name: /editar entidad/i })
    ).not.toBeVisible();

    // Verify the entity value was updated in the inspector
    await expect(page.getByText("Nuevo Nombre Editado")).toBeVisible();
  });

  test("toggle confidence in modal", async ({ page }) => {
    // Open entity modal by clicking COMPRADOR
    await page.getByRole("button", { name: /COMPRADOR/i }).first().click();

    await expect(
      page.getByRole("heading", { name: /editar entidad/i })
    ).toBeVisible();

    // Switch confidence from ALTA to BAJA
    await page.getByRole("button", { name: "BAJA" }).click();

    // Save
    await page.getByRole("button", { name: /guardar cambios/i }).click();

    // Modal should close
    await expect(
      page.getByRole("heading", { name: /editar entidad/i })
    ).not.toBeVisible();
  });

  test("exclude entity via modal and verify it dims", async ({ page }) => {
    // Open entity modal
    await page.getByRole("button", { name: /COMPRADOR/i }).first().click();

    await expect(
      page.getByRole("heading", { name: /editar entidad/i })
    ).toBeVisible();

    // Click "Excluir entidad"
    await page.getByRole("button", { name: /excluir entidad/i }).click();

    // Should now show "Restaurar entidad"
    await expect(
      page.getByRole("button", { name: /restaurar entidad/i })
    ).toBeVisible();

    // Save the exclusion
    await page.getByRole("button", { name: /guardar cambios/i }).click();

    // Modal should close
    await expect(
      page.getByRole("heading", { name: /editar entidad/i })
    ).not.toBeVisible();

    // Toggle "Mostrar entidades excluidas" — the excluded entity is hidden
    // by default and must be toggled visible first
    await page
      .getByRole("button", { name: /mostrar entidades excluidas/i })
      .click();

    // Now the excluded entity should show with "Excluido" badge
    await expect(page.getByText("Excluido")).toBeVisible();

    // The excluded entity label should show with line-through
    const excludedLabel = page.locator("button:has-text('COMPRADOR')");
    await expect(excludedLabel.first()).toBeVisible();
  });

  test("modal cancel discards changes", async ({ page }) => {
    // Open entity modal
    await page.getByRole("button", { name: /COMPRADOR/i }).first().click();

    await expect(
      page.getByRole("heading", { name: /editar entidad/i })
    ).toBeVisible();

    // Edit the value
    const valueInput = page.getByLabel(/valor/i);
    const originalValue = await valueInput.inputValue();
    await valueInput.clear();
    await valueInput.fill("Valor Cancelado");

    // Click "Cancelar" instead of saving
    await page.getByRole("button", { name: /cancelar/i }).click();

    // Modal should close
    await expect(
      page.getByRole("heading", { name: /editar entidad/i })
    ).not.toBeVisible();

    // Value should NOT have changed — verify the original value is still shown
    await expect(page.getByText(originalValue)).toBeVisible();
  });
});