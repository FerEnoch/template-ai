import { describe, it, expect } from "vitest";
import { wizardReducer, initialWizardState, getNextStep, getPrevStep } from "./wizardReducer";
import { WizardStep } from "./types";
import type { WizardState, WizardAction } from "./types";
import type { Entity } from "@template-ai/contracts";

const mockEntity: Entity = {
  id: "test-entity-1",
  label: "COMPRADOR",
  value: "Juan Pérez",
  group: "PARTES",
  confidence: "ALTA",
  sourceSpan: { start: 10, end: 20 },
  reviewed: false,
};

const mockEntity2: Entity = {
  id: "test-entity-2",
  label: "PRECIO_TOTAL",
  value: "$1,000,000",
  group: "INMUEBLE",
  confidence: "MEDIA",
  sourceSpan: { start: 30, end: 45 },
  reviewed: true,
};

describe("wizardReducer", () => {
  describe("SET_STEP", () => {
    it("updates currentStep", () => {
      const action: WizardAction = { type: "SET_STEP", step: WizardStep.ANALYSIS };
      const result = wizardReducer(initialWizardState, action);
      expect(result.currentStep).toBe(WizardStep.ANALYSIS);
    });
  });

  describe("SET_FILE", () => {
    it("sets the file field", () => {
      const file = { name: "contract.pdf", size: 1024, type: "application/pdf" };
      const action: WizardAction = { type: "SET_FILE", file };
      const result = wizardReducer(initialWizardState, action);
      expect(result.file).toEqual(file);
    });

    it("clears file when null is passed", () => {
      const stateWithFile: WizardState = {
        ...initialWizardState,
        file: { name: "contract.pdf", size: 1024, type: "application/pdf" },
      };
      const action: WizardAction = { type: "SET_FILE", file: null };
      const result = wizardReducer(stateWithFile, action);
      expect(result.file).toBeNull();
    });
  });

  describe("SET_ENTITIES", () => {
    it("replaces all entities", () => {
      const entities = [mockEntity, mockEntity2];
      const action: WizardAction = { type: "SET_ENTITIES", entities };
      const result = wizardReducer(initialWizardState, action);
      expect(result.entities).toHaveLength(2);
      expect(result.entities).toEqual(entities);
    });
  });

  describe("UPDATE_ENTITY", () => {
    it("updates an existing entity by id", () => {
      const stateWithEntities: WizardState = {
        ...initialWizardState,
        entities: [mockEntity, mockEntity2],
      };
      const updatedEntity = { ...mockEntity, reviewed: true };
      const action: WizardAction = { type: "UPDATE_ENTITY", entity: updatedEntity };
      const result = wizardReducer(stateWithEntities, action);
      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].reviewed).toBe(true);
      expect(result.entities[1].reviewed).toBe(true);
    });

    it("does nothing if entity id not found", () => {
      const stateWithEntities: WizardState = {
        ...initialWizardState,
        entities: [mockEntity],
      };
      const unknownEntity = { ...mockEntity, id: "unknown-id" };
      const action: WizardAction = { type: "UPDATE_ENTITY", entity: unknownEntity };
      const result = wizardReducer(stateWithEntities, action);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].id).toBe("test-entity-1");
    });
  });

  describe("SET_DRAFT", () => {
    it("applies draft state replacing relevant fields (currentStep unchanged)", () => {
      const draft: WizardState = {
        currentStep: WizardStep.REVIEW,
        file: { name: "draft.pdf", size: 2048, type: "application/pdf" },
        analysisResultId: "draft-analysis-id",
        entities: [mockEntity],
        templateForm: { name: "Draft", description: "A draft", category: "Contratos" },
      };
      const action: WizardAction = { type: "SET_DRAFT", draft };
      const result = wizardReducer(initialWizardState, action);
      expect(result.file).toEqual(draft.file);
      expect(result.analysisResultId).toBe("draft-analysis-id");
      expect(result.entities).toHaveLength(1);
      expect(result.templateForm).toEqual(draft.templateForm);
      // currentStep stays as initial (upload) since SET_DRAFT doesn't update it
      expect(result.currentStep).toBe(initialWizardState.currentStep);
    });
  });

  describe("LOAD_DRAFT", () => {
    // Note: LOAD_DRAFT preserves initialWizardState.currentStep (upload)
    // but restores all other fields from the draft.
    it("resets to initial then applies draft (restores all state except currentStep)", () => {
      const stateWithData: WizardState = {
        currentStep: WizardStep.SAVE,
        file: { name: "old.pdf", size: 999, type: "application/pdf" },
        analysisResultId: "old-analysis",
        entities: [mockEntity],
        templateForm: { name: "Old", description: "Old desc", category: "Laboral" },
      };
      const draft: WizardState = {
        currentStep: WizardStep.REVIEW,
        file: { name: "draft.pdf", size: 2048, type: "application/pdf" },
        analysisResultId: "draft-analysis-id",
        entities: [mockEntity, mockEntity2],
        templateForm: { name: "Draft", description: "A draft", category: "Contratos" },
      };
      const action: WizardAction = { type: "LOAD_DRAFT", draft };
      const result = wizardReducer(stateWithData, action);
      // currentStep is NOT restored from draft (keeps initialWizardState value)
      expect(result.currentStep).toBe(initialWizardState.currentStep);
      expect(result.file).toEqual(draft.file);
      expect(result.analysisResultId).toBe("draft-analysis-id");
      expect(result.entities).toHaveLength(2);
      expect(result.templateForm).toEqual(draft.templateForm);
    });

    it("handles draft with no entities", () => {
      const draft: WizardState = {
        ...initialWizardState,
        file: { name: "draft.pdf", size: 2048, type: "application/pdf" },
        entities: [],
      };
      const action: WizardAction = { type: "LOAD_DRAFT", draft };
      const result = wizardReducer(initialWizardState, action);
      expect(result.entities).toEqual([]);
    });
  });

  describe("RESET", () => {
    it("returns to initial state", () => {
      const dirtyState: WizardState = {
        currentStep: WizardStep.SAVE,
        file: { name: "dirty.pdf", size: 9999, type: "application/pdf" },
        analysisResultId: "dirty-analysis-id",
        entities: [mockEntity, mockEntity2],
        templateForm: { name: "Dirty", description: "Dirty desc", category: "Corporativo" },
      };
      const action: WizardAction = { type: "RESET" };
      const result = wizardReducer(dirtyState, action);
      expect(result).toEqual(initialWizardState);
    });
  });
});

describe("getNextStep", () => {
  it("returns next step in order", () => {
    expect(getNextStep(WizardStep.UPLOAD)).toBe(WizardStep.ANALYSIS);
    expect(getNextStep(WizardStep.ANALYSIS)).toBe(WizardStep.REVIEW);
    expect(getNextStep(WizardStep.REVIEW)).toBe(WizardStep.SAVE);
  });

  it("returns null for last step", () => {
    expect(getNextStep(WizardStep.SAVE)).toBeNull();
  });
});

describe("getPrevStep", () => {
  it("returns previous step in order", () => {
    expect(getPrevStep(WizardStep.SAVE)).toBe(WizardStep.REVIEW);
    expect(getPrevStep(WizardStep.REVIEW)).toBe(WizardStep.ANALYSIS);
    expect(getPrevStep(WizardStep.ANALYSIS)).toBe(WizardStep.UPLOAD);
  });

  it("returns null for first step", () => {
    expect(getPrevStep(WizardStep.UPLOAD)).toBeNull();
  });
});

describe("initialWizardState", () => {
  it("has correct defaults", () => {
    expect(initialWizardState.currentStep).toBe(WizardStep.UPLOAD);
    expect(initialWizardState.file).toBeNull();
    expect(initialWizardState.analysisResultId).toBeNull();
    expect(initialWizardState.entities).toEqual([]);
    expect(initialWizardState.templateForm).toBeNull();
  });
});