import type { Entity } from "@template-ai/contracts";

// WizardStep enum: ordered linear steps of the wizard
export enum WizardStep {
  UPLOAD = "upload",
  ANALYSIS = "analysis",
  REVIEW = "review",
  SAVE = "save",
}

// WizardState: complete state of the wizard flow
export interface WizardState {
  currentStep: WizardStep;
  file: {
    name: string;
    size: number;
    type: string;
  } | null;
  analysisResultId: string | null;
  entities: Entity[];
  templateForm: {
    name: string;
    description: string;
    category: string;
  } | null;
}

// WizardAction union: all possible state mutations
export type WizardAction =
  | { type: "SET_STEP"; step: WizardStep }
  | { type: "SET_FILE"; file: WizardState["file"] }
  | { type: "SET_ENTITIES"; entities: Entity[] }
  | { type: "SET_ANALYSIS_RESULT"; analysisResultId: string; entities: Entity[] }
  | { type: "UPDATE_ENTITY"; entity: Entity }
  | { type: "SET_DRAFT"; draft: WizardState }
  | { type: "LOAD_DRAFT"; draft: WizardState }
  | { type: "RESET" };

// Step order array for transitions
export const WIZARD_STEP_ORDER: WizardStep[] = [
  WizardStep.UPLOAD,
  WizardStep.ANALYSIS,
  WizardStep.REVIEW,
  WizardStep.SAVE,
];

// Steps that require a file to be uploaded before proceeding
export const STEPS_REQUIRING_FILE: WizardStep[] = [
  WizardStep.ANALYSIS,
  WizardStep.REVIEW,
  WizardStep.SAVE,
];

// Steps that require analysis to be complete
export const STEPS_REQUIRING_ANALYSIS: WizardStep[] = [
  WizardStep.REVIEW,
  WizardStep.SAVE,
];