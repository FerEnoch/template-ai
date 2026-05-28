import type { WizardState, WizardAction } from "./types";
import { WizardStep, WIZARD_STEP_ORDER } from "./types";

export const initialWizardState: WizardState = {
  currentStep: WizardStep.UPLOAD,
  file: null,
  analysisResultId: null,
  entities: [],
  templateForm: null,
};

export function wizardReducer(
  state: WizardState,
  action: WizardAction
): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, currentStep: action.step };

    case "SET_FILE":
      return { ...state, file: action.file };

    case "SET_ENTITIES":
      return { ...state, entities: action.entities };

    case "UPDATE_ENTITY": {
      const idx = state.entities.findIndex((e) => e.id === action.entity.id);
      if (idx === -1) return state;
      const entities = [...state.entities];
      entities[idx] = action.entity;
      return { ...state, entities };
    }

    case "SET_DRAFT":
      return {
        ...state,
        file: action.draft.file,
        analysisResultId: action.draft.analysisResultId,
        entities: action.draft.entities,
        templateForm: action.draft.templateForm,
      };

    case "LOAD_DRAFT":
      return {
        ...initialWizardState,
        file: action.draft.file,
        analysisResultId: action.draft.analysisResultId,
        entities: action.draft.entities ?? [],
        templateForm: action.draft.templateForm,
      };

    case "RESET":
      return initialWizardState;

    default:
      return state;
  }
}

/**
 * Returns the next step in the wizard or null if already at last step.
 */
export function getNextStep(current: WizardStep): WizardStep | null {
  const idx = WIZARD_STEP_ORDER.indexOf(current);
  if (idx === -1 || idx === WIZARD_STEP_ORDER.length - 1) return null;
  return WIZARD_STEP_ORDER[idx + 1];
}

/**
 * Returns the previous step in the wizard or null if already at first step.
 */
export function getPrevStep(current: WizardStep): WizardStep | null {
  const idx = WIZARD_STEP_ORDER.indexOf(current);
  if (idx <= 0) return null;
  return WIZARD_STEP_ORDER[idx - 1];
}