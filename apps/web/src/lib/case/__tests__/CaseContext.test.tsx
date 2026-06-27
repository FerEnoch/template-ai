import { describe, it, expect } from "vitest";
import { caseReducer, initialCaseState } from "../CaseContext";
import type { CaseState, CaseAction } from "../CaseContext";
import type { Template, Entity } from "@template-ai/contracts";

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
  id: "tpl-1",
  name: "Contrato de locación",
  description: "Plantilla de arrendamiento",
  documentId: "doc-1",
  entities: [mockEntity, mockEntity2],
  category: "Arrendamiento Urbano",
  createdAt: "2024-05-15T00:00:00Z",
  status: "published",
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
