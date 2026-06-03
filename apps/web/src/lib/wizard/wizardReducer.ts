import type { WizardState, WizardAction } from "./types";
import { WizardStep, WIZARD_STEP_ORDER } from "./types";

export const initialWizardState: WizardState = {
  currentStep: WizardStep.UPLOAD,
  file: null,
  analysisResultId: null,
  entities: [],
  extractedText: null,
  templateForm: null,
};

/**
 * Clears state that belongs to steps AFTER the target step.
 * This prevents stale data from allowing skip-ahead navigation.
 */
function clearDownstreamState(state: WizardState, targetStep: WizardStep): Partial<WizardState> {
  const targetIndex = WIZARD_STEP_ORDER.indexOf(targetStep);

  // For UPLOAD: clear everything downstream (keep file)
  if (targetStep === WizardStep.UPLOAD) {
    return {
      analysisResultId: null,
      entities: [],
      extractedText: null,
      templateForm: null,
    };
  }

  // For ANALYSIS: clear review/save state (keep file, analysisResultId, entities)
  if (targetStep === WizardStep.ANALYSIS) {
    return {
      templateForm: null,
    };
  }

  // For REVIEW: clear save state (keep everything else)
  if (targetStep === WizardStep.REVIEW) {
    return {
      templateForm: null,
    };
  }

  // SAVE: keep everything — user is at the last step
  return {};
}

export function wizardReducer(
  state: WizardState,
  action: WizardAction
): WizardState {
  switch (action.type) {
    case "SET_STEP": {
      const cleared = action.clearDownstream
        ? clearDownstreamState(state, action.step)
        : {};
      return { ...state, currentStep: action.step, ...cleared };
    }

    case "SET_FILE":
      return { ...state, file: action.file };

    case "SET_ENTITIES":
      return { ...state, entities: action.entities };

    case "SET_ANALYSIS_RESULT":
      return {
        ...state,
        analysisResultId: action.analysisResultId,
        entities: action.entities,
        extractedText: action.extractedText,
      };

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
        extractedText: action.draft.extractedText,
        templateForm: action.draft.templateForm,
      };

    case "LOAD_DRAFT":
      return {
        ...initialWizardState,
        file: action.draft.file,
        analysisResultId: action.draft.analysisResultId,
        entities: action.draft.entities ?? [],
        extractedText: action.draft.extractedText ?? null,
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
