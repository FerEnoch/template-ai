"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { WizardState, WizardAction } from "./types";
import { WizardStep } from "./types";
import {
  wizardReducer,
  initialWizardState,
} from "./wizardReducer";
import { getNextStep, getPrevStep } from "./wizardReducer";
import {
  STEPS_REQUIRING_FILE,
  STEPS_REQUIRING_ANALYSIS,
} from "./types";

/** Maps each wizard step to its route path segment */
export const STEP_PATH: Record<WizardStep, string> = {
  [WizardStep.UPLOAD]: "/upload",
  [WizardStep.ANALYSIS]: "/analysis",
  [WizardStep.REVIEW]: "/review",
  [WizardStep.SAVE]: "/save",
};

/** Builds the full route URL for a step (path + query param) */
export function stepUrl(step: WizardStep): string {
  return `${STEP_PATH[step]}?step=${step}`;
}

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  currentStep: WizardStep;
  canProceed: boolean;
  canGoBack: boolean;
  nextStep: () => void;
  prevStep: () => void;
  setStep: (step: WizardStep) => void;
  setFile: (file: WizardState["file"], fileObject?: File) => void;
  fileRef: React.MutableRefObject<File | null>;
  setEntities: (entities: WizardState["entities"]) => void;
  setAnalysisResult: (analysisResultId: string, entities: WizardState["entities"]) => void;
  updateEntity: (entity: WizardState["entities"][number]) => void;
  setDraft: (draft: WizardState) => void;
  loadDraft: (draft: WizardState) => void;
  reset: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

interface WizardProviderProps {
  readonly children: ReactNode;
}

export function WizardProvider({ children }: WizardProviderProps) {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileRef = useRef<File | null>(null);

  // Sync ?step= param on mount
  useEffect(() => {
    const stepParam = searchParams.get("step") as WizardStep | null;
    if (stepParam && stepParam !== state.currentStep) {
      dispatch({ type: "SET_STEP", step: stepParam });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  const currentStep = state.currentStep;

  const canProceed = (() => {
    if (STEPS_REQUIRING_FILE.includes(currentStep) && !state.file) {
      return false;
    }
    if (STEPS_REQUIRING_ANALYSIS.includes(currentStep) && !state.analysisResultId) {
      return false;
    }
    return true;
  })();

  const canGoBack = getPrevStep(currentStep) !== null;

  const nextStep = useCallback(() => {
    const next = getNextStep(currentStep);
    if (next) {
      dispatch({ type: "SET_STEP", step: next, clearDownstream: true });
      router.push(stepUrl(next));
    }
  }, [currentStep, router]);

  const prevStep = useCallback(() => {
    const prev = getPrevStep(currentStep);
    if (prev) {
      dispatch({ type: "SET_STEP", step: prev, clearDownstream: true });
      router.push(stepUrl(prev));
    }
  }, [currentStep, router]);

  const setStep = useCallback(
    (step: WizardStep) => {
      dispatch({ type: "SET_STEP", step, clearDownstream: true });
      router.push(stepUrl(step));
    },
    [router]
  );

  const setFile = useCallback(
    (file: WizardState["file"], fileObject?: File) => {
      dispatch({ type: "SET_FILE", file });
      if (fileObject) {
        fileRef.current = fileObject;
      } else if (!file) {
        fileRef.current = null;
      }
    },
    []
  );

  const setEntities = useCallback(
    (entities: WizardState["entities"]) => {
      dispatch({ type: "SET_ENTITIES", entities });
    },
    []
  );

  const setAnalysisResult = useCallback(
    (analysisResultId: string, entities: WizardState["entities"]) => {
      dispatch({ type: "SET_ANALYSIS_RESULT", analysisResultId, entities });
    },
    []
  );

  const updateEntity = useCallback(
    (entity: WizardState["entities"][number]) => {
      dispatch({ type: "UPDATE_ENTITY", entity });
    },
    []
  );

  const setDraft = useCallback(
    (draft: WizardState) => {
      dispatch({ type: "SET_DRAFT", draft });
    },
    []
  );

  const loadDraft = useCallback(
    (draft: WizardState) => {
      dispatch({ type: "LOAD_DRAFT", draft });
    },
    []
  );

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
    fileRef.current = null;
    router.push(stepUrl(WizardStep.UPLOAD));
  }, [router]);

  return (
    <WizardContext.Provider
      value={{
        state,
        dispatch,
        currentStep,
        canProceed,
        canGoBack,
        nextStep,
        prevStep,
        setStep,
        setFile,
        fileRef,
        setEntities,
        setAnalysisResult,
        updateEntity,
        setDraft,
        loadDraft,
        reset,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) {
    throw new Error("useWizard must be used within a WizardProvider");
  }
  return ctx;
}