import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useEffect, useState } from "react";
import { caseReducer, initialCaseState, CaseProvider, useCase } from "../CaseContext";
import type { CaseState, CaseAction } from "../CaseContext";
import type { Template, Entity, Case } from "@template-ai/contracts";

let mockStore: Record<string, string> = {};

const DRAFT_KEY = "case-form-draft:v1:550e8400-e29b-41d4-a716-446655440000";

beforeEach(() => {
  mockStore = {};
  Object.defineProperty(globalThis, "sessionStorage", {
    value: {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStore[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function TestConsumer({
  template,
  caseItem,
  onReady,
}: {
  template: Template;
  caseItem: Case;
  onReady?: (api: ReturnType<typeof useCase>) => void;
}) {
  const api = useCase();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.setTemplate(template);
    api.setCase(caseItem);
    setReady(true);
    onReady?.(api);
  }, []);

  return (
    <div>
      <span data-testid="ready">{ready ? "ready" : "loading"}</span>
      <span data-testid="caseId">{api.state.caseId ?? "none"}</span>
      <span data-testid="formData">{JSON.stringify(api.state.formData)}</span>
    </div>
  );
}

const mockEntity: Entity = {
  id: "ent-1",
  label: "Nombre del locador",
  value: "",
  group: "PARTES",
  confidence: "ALTA",
  reviewed: false,
  excluded: false,
  userCreated: false,
};

const mockEntity2: Entity = {
  id: "ent-2",
  label: "Dirección completa",
  value: "",
  group: "INMUEBLE",
  confidence: "ALTA",
  reviewed: false,
  excluded: false,
  userCreated: false,
};

const mockTemplate: Template = {
  id: "660e8400-e29b-41d4-a716-446655440001",
  name: "Contrato de locación",
  description: "Plantilla de arrendamiento",
  documentId: "doc-1",
  entities: [mockEntity, mockEntity2],
  category: "Arrendamiento Urbano",
  createdAt: "2024-05-15T00:00:00Z",
  status: "published",
};

const mockCase: Case = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  userId: 1,
  templateId: "660e8400-e29b-41d4-a716-446655440001",
  status: "borrador",
  formData: {},
  generatedText: null,
  createdAt: "2024-05-15T00:00:00Z",
  updatedAt: "2024-05-15T00:00:00Z",
};

describe("caseReducer", () => {
  describe("SET_TEMPLATE", () => {
    it("sets template and derives entities", () => {
      const action: CaseAction = { type: "SET_TEMPLATE", payload: mockTemplate };
      const result = caseReducer(initialCaseState, action);
      expect(result.template).toEqual(mockTemplate);
      expect(result.entities).toEqual(mockTemplate.entities);
    });
  });

  describe("UPDATE_FIELD", () => {
    it("updates formData for an entity and recomputes progress", () => {
      const state: CaseState = {
        ...initialCaseState,
        entities: [mockEntity, mockEntity2],
        formData: {},
        progress: 0,
      };
      const action: CaseAction = {
        type: "UPDATE_FIELD",
        payload: { entityId: "ent-1", value: "Julián Ruiz" },
      };
      const result = caseReducer(state, action);
      expect(result.formData["ent-1"]).toBe("Julián Ruiz");
      expect(result.progress).toBe(50);
    });

    it("removes value when empty string is provided", () => {
      const state: CaseState = {
        ...initialCaseState,
        entities: [mockEntity],
        formData: { "ent-1": "Julián Ruiz" },
        progress: 100,
      };
      const action: CaseAction = {
        type: "UPDATE_FIELD",
        payload: { entityId: "ent-1", value: "" },
      };
      const result = caseReducer(state, action);
      expect(result.formData["ent-1"]).toBeUndefined();
      expect(result.progress).toBe(0);
    });
  });

  describe("SET_CASE_ID", () => {
    it("sets caseId and caseStatus", () => {
      const action: CaseAction = {
        type: "SET_CASE_ID",
        payload: { caseId: "case-1", caseStatus: "borrador" },
      };
      const result = caseReducer(initialCaseState, action);
      expect(result.caseId).toBe("case-1");
      expect(result.caseStatus).toBe("borrador");
    });
  });

  describe("SET_STATUS", () => {
    it("sets UI status", () => {
      const action: CaseAction = { type: "SET_STATUS", payload: "saving" };
      const result = caseReducer(initialCaseState, action);
      expect(result.status).toBe("saving");
    });
  });

  describe("SET_LOADING", () => {
    it("sets loading flag", () => {
      const action: CaseAction = { type: "SET_LOADING", payload: true };
      const result = caseReducer(initialCaseState, action);
      expect(result.loading).toBe(true);
    });
  });

  describe("SET_ERROR", () => {
    it("sets error message", () => {
      const action: CaseAction = {
        type: "SET_ERROR",
        payload: "No se pudo cargar la plantilla",
      };
      const result = caseReducer(initialCaseState, action);
      expect(result.error).toBe("No se pudo cargar la plantilla");
    });

    it("clears error when null is provided", () => {
      const state: CaseState = {
        ...initialCaseState,
        error: "Algo salió mal",
      };
      const action: CaseAction = { type: "SET_ERROR", payload: null };
      const result = caseReducer(state, action);
      expect(result.error).toBeNull();
    });
  });
});

describe("CaseProvider", () => {
  it("renders a child consumer", () => {
    const { getByTestId } = render(
      <CaseProvider>
        <TestConsumer template={mockTemplate} caseItem={mockCase} />
      </CaseProvider>
    );
    expect(getByTestId("ready")).toBeInTheDocument();
  });

  it("hydrates formData from sessionStorage when caseId matches", async () => {
    mockStore[DRAFT_KEY] = JSON.stringify({
      caseId: "550e8400-e29b-41d4-a716-446655440000",
      templateId: "660e8400-e29b-41d4-a716-446655440001",
      formData: { "ent-1": "Julián Ruiz" },
      savedAt: new Date().toISOString(),
    });

    const { getByTestId } = render(
      <CaseProvider>
        <TestConsumer template={mockTemplate} caseItem={mockCase} />
      </CaseProvider>
    );

    await waitFor(() => expect(getByTestId("ready").textContent).toBe("ready"));

    await waitFor(() =>
      expect(getByTestId("formData").textContent).toBe(
        JSON.stringify({ "ent-1": "Julián Ruiz" })
      )
    );
  });

  it("drops stale entity keys during hydration", async () => {
    mockStore[DRAFT_KEY] = JSON.stringify({
      caseId: "550e8400-e29b-41d4-a716-446655440000",
      templateId: "660e8400-e29b-41d4-a716-446655440001",
      formData: { "ent-1": "Julián Ruiz", "ent-stale": "old value" },
      savedAt: new Date().toISOString(),
    });

    const { getByTestId } = render(
      <CaseProvider>
        <TestConsumer template={mockTemplate} caseItem={mockCase} />
      </CaseProvider>
    );

    await waitFor(() => expect(getByTestId("ready").textContent).toBe("ready"));

    await waitFor(() =>
      expect(getByTestId("formData").textContent).toBe(
        JSON.stringify({ "ent-1": "Julián Ruiz" })
      )
    );
  });

  it("does not hydrate when draft caseId does not match", async () => {
    mockStore["case-form-draft:v1:770e8400-e29b-41d4-a716-446655440002"] = JSON.stringify({
      caseId: "770e8400-e29b-41d4-a716-446655440002",
      templateId: "660e8400-e29b-41d4-a716-446655440001",
      formData: { "ent-1": "Julián Ruiz" },
      savedAt: new Date().toISOString(),
    });

    const { getByTestId } = render(
      <CaseProvider>
        <TestConsumer template={mockTemplate} caseItem={mockCase} />
      </CaseProvider>
    );

    await waitFor(() => expect(getByTestId("ready").textContent).toBe("ready"));

    expect(getByTestId("formData").textContent).toBe(JSON.stringify({}));
  });

  it("debounces sessionStorage write after UPDATE_FIELD", async () => {
    let apiRef: ReturnType<typeof useCase> | undefined;

    const { getByTestId } = render(
      <CaseProvider>
        <TestConsumer
          template={mockTemplate}
          caseItem={mockCase}
          onReady={(api) => {
            apiRef = api;
          }}
        />
      </CaseProvider>
    );

    await waitFor(() => expect(getByTestId("ready").textContent).toBe("ready"));

    apiRef!.updateField("ent-1", "Julián Ruiz");
    apiRef!.updateField("ent-1", "Julián Ruiz Updated");

    expect(mockStore[DRAFT_KEY]).toBeUndefined();

    await waitFor(() =>
      expect(mockStore[DRAFT_KEY]).not.toBeUndefined()
    );

    const stored = JSON.parse(mockStore[DRAFT_KEY]);
    expect(stored.formData["ent-1"]).toBe("Julián Ruiz Updated");
    expect(stored.caseId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(stored.templateId).toBe("660e8400-e29b-41d4-a716-446655440001");
  });

  it("clearDraft removes the sessionStorage key", async () => {
    mockStore[DRAFT_KEY] = JSON.stringify({
      caseId: "550e8400-e29b-41d4-a716-446655440000",
      templateId: "660e8400-e29b-41d4-a716-446655440001",
      formData: { "ent-1": "Julián Ruiz" },
      savedAt: new Date().toISOString(),
    });

    let apiRef: ReturnType<typeof useCase> | undefined;

    const { getByTestId } = render(
      <CaseProvider>
        <TestConsumer
          template={mockTemplate}
          caseItem={mockCase}
          onReady={(api) => {
            apiRef = api;
          }}
        />
      </CaseProvider>
    );

    await waitFor(() => expect(getByTestId("ready").textContent).toBe("ready"));

    apiRef!.clearDraft("550e8400-e29b-41d4-a716-446655440000");

    expect(mockStore[DRAFT_KEY]).toBeUndefined();
  });

  it("clearDraft cancels a pending debounced write and prevents it from firing", async () => {
    let apiRef: ReturnType<typeof useCase> | undefined;

    const { getByTestId } = render(
      <CaseProvider>
        <TestConsumer
          template={mockTemplate}
          caseItem={mockCase}
          onReady={(api) => {
            apiRef = api;
          }}
        />
      </CaseProvider>
    );

    await waitFor(() => expect(getByTestId("ready").textContent).toBe("ready"));

    // Type to schedule a debounced write (300ms timer)
    apiRef!.updateField("ent-1", "Pending value");

    // Wait for the re-render so the debounced write effect schedules its timer
    await waitFor(() =>
      expect(getByTestId("formData").textContent).toBe(
        JSON.stringify({ "ent-1": "Pending value" })
      )
    );

    // Immediately clear before the 300ms timer fires
    apiRef!.clearDraft("550e8400-e29b-41d4-a716-446655440000");

    // Wait past the debounce window — the cancelled write must NOT have fired
    await new Promise((r) => setTimeout(r, 400));
    expect(mockStore[DRAFT_KEY]).toBeUndefined();
  });

  it("hydrates only once per caseId", async () => {
    const loadSpy = vi.fn(() =>
      JSON.stringify({
        caseId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "660e8400-e29b-41d4-a716-446655440001",
        formData: { "ent-1": "Julián Ruiz" },
        savedAt: new Date().toISOString(),
      })
    );
    Object.defineProperty(globalThis, "sessionStorage", {
      value: {
        getItem: loadSpy,
        setItem: () => {},
        removeItem: () => {},
      },
      writable: true,
      configurable: true,
    });

    let apiRef: ReturnType<typeof useCase> | undefined;

    const { getByTestId, rerender } = render(
      <CaseProvider>
        <TestConsumer
          template={mockTemplate}
          caseItem={mockCase}
          onReady={(api) => {
            apiRef = api;
          }}
        />
      </CaseProvider>
    );

    await waitFor(() => expect(getByTestId("ready").textContent).toBe("ready"));

    // Force a re-render by updating field
    apiRef!.updateField("ent-1", "trigger re-render");

    rerender(
      <CaseProvider>
        <TestConsumer
          template={mockTemplate}
          caseItem={mockCase}
          onReady={(api) => {
            apiRef = api;
          }}
        />
      </CaseProvider>
    );

    expect(loadSpy).toHaveBeenCalledTimes(1);
  });
});
