import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { StrictMode } from "react";
import "@testing-library/jest-dom/vitest";
import NuevoCasoPage from "../page";
import type { Template, Case, Entity } from "@template-ai/contracts";

const templateId = "00000000-0000-0000-0000-000000000001";
const caseId = "00000000-0000-0000-0000-000000000002";

vi.mock("next/navigation", () => ({
  useParams: () => ({ templateId }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const baseDate = "2025-06-28T00:00:00Z";

function makeEntity(id: string, label: string, group: Entity["group"] = "PARTES"): Entity {
  return {
    id,
    label,
    value: "",
    group,
    confidence: "ALTA",
    reviewed: false,
    excluded: false,
    userCreated: false,
  };
}

const entities: Entity[] = [
  makeEntity("00000000-0000-0000-0000-000000000003", "Locador"),
  makeEntity("00000000-0000-0000-0000-000000000004", "Locatario"),
  makeEntity("00000000-0000-0000-0000-000000000005", "Garante"),
  makeEntity("00000000-0000-0000-0000-000000000006", "Dirección"),
  makeEntity("00000000-0000-0000-0000-000000000007", "Monto"),
];

const mockTemplate: Template = {
  id: templateId,
  name: "Contrato de locación",
  description: "Plantilla de prueba",
  documentId: "00000000-0000-0000-0000-000000000008",
  entities,
  category: "Arrendamiento Urbano",
  status: "published",
  createdAt: baseDate,
};

const mockCase: Case = {
  id: caseId,
  userId: 1,
  templateId,
  status: "borrador",
  formData: {},
  generatedText: null,
  createdAt: baseDate,
  updatedAt: baseDate,
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("NuevoCasoPage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("only POSTs /api/cases once under StrictMode double-mount", async () => {
    let postCount = 0;
    const fetchMock = vi.fn(global.fetch).mockImplementation(async (input, init) => {
      const url = input.toString();
      if (url === `/api/templates/${templateId}`) {
        return jsonResponse(mockTemplate);
      }
      if (url === "/api/cases" && init?.method === "POST") {
        postCount++;
        return jsonResponse(mockCase);
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <StrictMode>
        <NuevoCasoPage />
      </StrictMode>
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Generar documento/i })).toBeInTheDocument()
    );

    expect(postCount).toBe(1);
  });

  it("aborts the bootstrap create request when the component unmounts", async () => {
    let createSignal: AbortSignal | undefined;
    const fetchMock = vi.fn(global.fetch).mockImplementation(async (input, init) => {
      const url = input.toString();
      if (url === `/api/templates/${templateId}`) {
        return jsonResponse(mockTemplate);
      }
      if (url === "/api/cases" && init?.method === "POST") {
        createSignal = init?.signal ?? undefined;
        return new Promise(() => {});
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { unmount } = render(<NuevoCasoPage />);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/cases",
        expect.objectContaining({ method: "POST" })
      )
    );

    unmount();

    expect(createSignal).toBeDefined();
    expect(createSignal?.aborted).toBe(true);
  });

  it("calls generateCase only once when Generar is clicked twice in the same tick", async () => {
    let generateCount = 0;
    const fetchMock = vi.fn(global.fetch).mockImplementation(async (input, init) => {
      const url = input.toString();
      if (url === `/api/templates/${templateId}`) {
        return jsonResponse(mockTemplate);
      }
      if (url === "/api/cases" && init?.method === "POST") {
        return jsonResponse(mockCase);
      }
      if (url === `/api/cases/${caseId}` && init?.method === "PATCH") {
        return jsonResponse({ ...mockCase, formData: { filled: "yes" } });
      }
      if (url === `/api/cases/${caseId}/generate` && init?.method === "POST") {
        generateCount++;
        return jsonResponse({ ...mockCase, status: "generado" });
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NuevoCasoPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Generar documento/i })).toBeInTheDocument()
    );

    // Fill 4 of 5 fields to reach 80% progress and enable the generate button.
    for (const label of ["Locador", "Locatario", "Garante", "Dirección"]) {
      fireEvent.change(screen.getByLabelText(new RegExp(label)), { target: { value: "x" } });
    }

    const generateButton = screen.getByRole("button", { name: /Generar documento/i });
    fireEvent.click(generateButton);
    fireEvent.click(generateButton);

    await waitFor(() => expect(generateCount).toBeGreaterThanOrEqual(1));

    expect(generateCount).toBe(1);
  });

  it("resets the generation guard after generateCase throws so a second click retries", async () => {
    let generateCount = 0;
    const fetchMock = vi.fn(global.fetch).mockImplementation(async (input, init) => {
      const url = input.toString();
      if (url === `/api/templates/${templateId}`) {
        return jsonResponse(mockTemplate);
      }
      if (url === "/api/cases" && init?.method === "POST") {
        return jsonResponse(mockCase);
      }
      if (url === `/api/cases/${caseId}` && init?.method === "PATCH") {
        return jsonResponse({ ...mockCase, formData: { filled: "yes" } });
      }
      if (url === `/api/cases/${caseId}/generate` && init?.method === "POST") {
        generateCount++;
        return jsonResponse({ error: "Generation failed" }, 500);
      }
      return new Response(null, { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<NuevoCasoPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Generar documento/i })).toBeInTheDocument()
    );

    for (const label of ["Locador", "Locatario", "Garante", "Dirección"]) {
      fireEvent.change(screen.getByLabelText(new RegExp(label)), { target: { value: "x" } });
    }

    const generateButton = screen.getByRole("button", { name: /Generar documento/i });
    fireEvent.click(generateButton);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Generar documento/i })).toBeEnabled()
    );

    fireEvent.click(generateButton);

    await waitFor(() => expect(generateCount).toBe(2));

    expect(generateCount).toBe(2);
  });
});
