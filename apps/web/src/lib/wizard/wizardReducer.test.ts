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
  excluded: false,
};

const mockEntity2: Entity = {
  id: "test-entity-2",
  label: "PRECIO_TOTAL",
  value: "$1,000,000",
  group: "INMUEBLE",
  confidence: "MEDIA",
  sourceSpan: { start: 30, end: 45 },
  reviewed: true,
  excluded: false,
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

  describe("SET_ANALYSIS_RESULT", () => {
    it("stores extractedText with analysis result", () => {
      const action = {
        type: "SET_ANALYSIS_RESULT",
        analysisResultId: "analysis-123",
        entities: [mockEntity],
        extractedText: "Texto completo del contrato",
      } as WizardAction;

      const result = wizardReducer(initialWizardState, action);
      expect((result as { extractedText?: string | null }).extractedText).toBe(
        "Texto completo del contrato",
      );
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
      const draft = {
        currentStep: WizardStep.REVIEW,
        file: { name: "draft.pdf", size: 2048, type: "application/pdf" },
        analysisResultId: "draft-analysis-id",
        entities: [mockEntity],
        templateForm: { name: "Draft", description: "A draft", category: "Contratos" },
        extractedText: "Borrador extraído",
      } as WizardState;
      const action: WizardAction = { type: "SET_DRAFT", draft };
      const result = wizardReducer(initialWizardState, action);
      expect(result.file).toEqual(draft.file);
      expect(result.analysisResultId).toBe("draft-analysis-id");
      expect(result.entities).toHaveLength(1);
      expect(result.templateForm).toEqual(draft.templateForm);
      expect((result as { extractedText?: string | null }).extractedText).toBe(
        "Borrador extraído",
      );
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
        extractedText: "Texto anterior",
        templateForm: { name: "Old", description: "Old desc", category: "Laboral" },
      };
      const draft = {
        currentStep: WizardStep.REVIEW,
        file: { name: "draft.pdf", size: 2048, type: "application/pdf" },
        analysisResultId: "draft-analysis-id",
        entities: [mockEntity, mockEntity2],
        templateForm: { name: "Draft", description: "A draft", category: "Contratos" },
        extractedText: "Texto cargado",
      } as WizardState;
      const action: WizardAction = { type: "LOAD_DRAFT", draft };
      const result = wizardReducer(stateWithData, action);
      // currentStep is NOT restored from draft (keeps initialWizardState value)
      expect(result.currentStep).toBe(initialWizardState.currentStep);
      expect(result.file).toEqual(draft.file);
      expect(result.analysisResultId).toBe("draft-analysis-id");
      expect(result.entities).toHaveLength(2);
      expect(result.templateForm).toEqual(draft.templateForm);
      expect((result as { extractedText?: string | null }).extractedText).toBe("Texto cargado");
    });

    it("handles draft with no entities", () => {
      const draft: WizardState = {
        ...initialWizardState,
        file: { name: "draft.pdf", size: 2048, type: "application/pdf" },
        entities: [],
        extractedText: null,
      };
      const action: WizardAction = { type: "LOAD_DRAFT", draft };
      const result = wizardReducer(initialWizardState, action);
      expect(result.entities).toEqual([]);
    });
  });

  describe("ADD_ENTITY", () => {
    it("appends a new entity to state.entities", () => {
      const newEntity: Entity = {
        id: "manual-entity-1",
        label: "Arrendatario",
        value: "María García",
        group: "PARTES",
        confidence: "ALTA",
        sourceSpan: { start: 50, end: 62 },
        reviewed: false,
        excluded: false,
        userCreated: true,
      };
      const stateWithEntities: WizardState = {
        ...initialWizardState,
        entities: [mockEntity],
      };
      const action: WizardAction = { type: "ADD_ENTITY", entity: newEntity };
      const result = wizardReducer(stateWithEntities, action);
      expect(result.entities).toHaveLength(2);
      expect(result.entities[1]).toEqual(newEntity);
    });

    it("preserves existing entities when adding a new one", () => {
      const newEntity: Entity = {
        id: "manual-entity-2",
        label: "Dirección",
        value: "Av. Corrientes 1234",
        group: "INMUEBLE",
        confidence: "ALTA",
        sourceSpan: { start: 100, end: 120 },
        reviewed: false,
        excluded: false,
        userCreated: true,
      };
      const stateWithEntities: WizardState = {
        ...initialWizardState,
        entities: [mockEntity, mockEntity2],
      };
      const action: WizardAction = { type: "ADD_ENTITY", entity: newEntity };
      const result = wizardReducer(stateWithEntities, action);
      expect(result.entities).toHaveLength(3);
      expect(result.entities[0]).toEqual(mockEntity);
      expect(result.entities[1]).toEqual(mockEntity2);
      expect(result.entities[2]).toEqual(newEntity);
    });

    it("adds entity to empty state", () => {
      const newEntity: Entity = {
        id: "manual-entity-3",
        label: "Fecha",
        value: "15/03/2024",
        group: "FECHAS",
        confidence: "ALTA",
        sourceSpan: { start: 200, end: 210 },
        reviewed: false,
        excluded: false,
        userCreated: true,
      };
      const action: WizardAction = { type: "ADD_ENTITY", entity: newEntity };
      const result = wizardReducer(initialWizardState, action);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0]).toEqual(newEntity);
    });
  });

  describe("RESET", () => {
    it("returns to initial state", () => {
      const dirtyState = {
        currentStep: WizardStep.SAVE,
        file: { name: "dirty.pdf", size: 9999, type: "application/pdf" },
        analysisResultId: "dirty-analysis-id",
        entities: [mockEntity, mockEntity2],
        templateForm: { name: "Dirty", description: "Dirty desc", category: "Corporativo" },
        extractedText: "Texto sucio",
      } as WizardState;
      const action: WizardAction = { type: "RESET" };
      const result = wizardReducer(dirtyState, action);
      expect(result).toEqual(initialWizardState);
      expect((result as { extractedText?: string | null }).extractedText).toBeNull();
    });
  });
});

describe("SET_STEP with clearDownstream", () => {
    it("clears analysisResultId, entities, and templateForm when going back to UPLOAD", () => {
      const stateWithData = {
        currentStep: WizardStep.REVIEW,
        file: { name: "contract.pdf", size: 1024, type: "application/pdf" },
        analysisResultId: "analysis-123",
        entities: [mockEntity, mockEntity2],
        templateForm: { name: "Template", description: "Desc", category: "Contratos" },
        extractedText: "Texto para limpiar",
      } as WizardState;
      const action: WizardAction = {
        type: "SET_STEP",
        step: WizardStep.UPLOAD,
        clearDownstream: true,
      };
      const result = wizardReducer(stateWithData, action);
      expect(result.currentStep).toBe(WizardStep.UPLOAD);
      expect(result.file).toEqual(stateWithData.file); // file preserved
      expect(result.analysisResultId).toBeNull();
      expect(result.entities).toEqual([]);
      expect(result.templateForm).toBeNull();
      expect((result as { extractedText?: string | null }).extractedText).toBeNull();
    });

    it("clears templateForm when going back to ANALYSIS", () => {
      const stateWithData: WizardState = {
        currentStep: WizardStep.REVIEW,
        file: { name: "contract.pdf", size: 1024, type: "application/pdf" },
        analysisResultId: "analysis-123",
        entities: [mockEntity],
        extractedText: "Texto",
        templateForm: { name: "Template", description: "Desc", category: "Contratos" },
      };
      const action: WizardAction = {
        type: "SET_STEP",
        step: WizardStep.ANALYSIS,
        clearDownstream: true,
      };
      const result = wizardReducer(stateWithData, action);
      expect(result.currentStep).toBe(WizardStep.ANALYSIS);
      expect(result.file).toEqual(stateWithData.file); // preserved
      expect(result.analysisResultId).toBe("analysis-123"); // preserved
      expect(result.entities).toHaveLength(1); // preserved
      expect(result.templateForm).toBeNull(); // cleared
    });

    it("clears templateForm when going back to REVIEW", () => {
      const stateWithData: WizardState = {
        currentStep: WizardStep.SAVE,
        file: { name: "contract.pdf", size: 1024, type: "application/pdf" },
        analysisResultId: "analysis-123",
        entities: [mockEntity],
        extractedText: "Texto",
        templateForm: { name: "Template", description: "Desc", category: "Contratos" },
      };
      const action: WizardAction = {
        type: "SET_STEP",
        step: WizardStep.REVIEW,
        clearDownstream: true,
      };
      const result = wizardReducer(stateWithData, action);
      expect(result.currentStep).toBe(WizardStep.REVIEW);
      expect(result.analysisResultId).toBe("analysis-123"); // preserved
      expect(result.entities).toHaveLength(1); // preserved
      expect(result.templateForm).toBeNull(); // cleared
    });

    it("keeps all state when navigating to SAVE (last step)", () => {
      const stateWithData: WizardState = {
        currentStep: WizardStep.REVIEW,
        file: { name: "contract.pdf", size: 1024, type: "application/pdf" },
        analysisResultId: "analysis-123",
        entities: [mockEntity],
        extractedText: "Texto",
        templateForm: { name: "Template", description: "Desc", category: "Contratos" },
      };
      const action: WizardAction = {
        type: "SET_STEP",
        step: WizardStep.SAVE,
        clearDownstream: true,
      };
      const result = wizardReducer(stateWithData, action);
      expect(result.currentStep).toBe(WizardStep.SAVE);
      expect(result.file).toEqual(stateWithData.file);
      expect(result.analysisResultId).toBe("analysis-123");
      expect(result.entities).toHaveLength(1);
      expect(result.templateForm).toEqual(stateWithData.templateForm);
    });

    it("does NOT clear downstream when clearDownstream is false/undefined (backward compat)", () => {
      const stateWithData: WizardState = {
        currentStep: WizardStep.UPLOAD,
        file: null,
        analysisResultId: "old-analysis",
        entities: [mockEntity],
        extractedText: "Texto viejo",
        templateForm: null,
      };
      const action: WizardAction = {
        type: "SET_STEP",
        step: WizardStep.REVIEW,
        // clearDownstream not set (old behavior)
      };
      const result = wizardReducer(stateWithData, action);
      expect(result.currentStep).toBe(WizardStep.REVIEW);
      expect(result.analysisResultId).toBe("old-analysis"); // NOT cleared
      expect(result.entities).toHaveLength(1); // NOT cleared
    });

    it("going from step 3 back to step 1 clears analysis results preventing skip-ahead", () => {
      // Simulates the exact bug: user at REVIEW, goes back to UPLOAD
      // After cleanup, canProceed should be false (no file or analysisId)
      const step3State: WizardState = {
        currentStep: WizardStep.REVIEW,
        file: { name: "contract.pdf", size: 1024, type: "application/pdf" },
        analysisResultId: "result-abc",
        entities: [mockEntity, mockEntity2],
        extractedText: "Texto en review",
        templateForm: null,
      };

      // Navigate back to UPLOAD with cleanup
      const backToUpload: WizardAction = {
        type: "SET_STEP",
        step: WizardStep.UPLOAD,
        clearDownstream: true,
      };
      const afterUpload = wizardReducer(step3State, backToUpload);
      expect(afterUpload.currentStep).toBe(WizardStep.UPLOAD);
      expect(afterUpload.file).toEqual(step3State.file); // file preserved
      expect(afterUpload.analysisResultId).toBeNull(); // cleared — prevents skip
      expect(afterUpload.entities).toEqual([]); // cleared — prevents skip

      // Now if user goes to ANALYSIS step, canProceed should be false
      // because analysisResultId is null and file exists but no analysis done yet
      const toAnalysis: WizardAction = {
        type: "SET_STEP",
        step: WizardStep.ANALYSIS,
        clearDownstream: true,
      };
      const atAnalysis = wizardReducer(afterUpload, toAnalysis);
      expect(atAnalysis.currentStep).toBe(WizardStep.ANALYSIS);
      expect(atAnalysis.analysisResultId).toBeNull(); // still null — analysis not done
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
    expect(initialWizardState.extractedText).toBeNull();
    expect(initialWizardState.templateForm).toBeNull();
  });
});
