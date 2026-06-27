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
import type { Template, Entity, Case } from "@template-ai/contracts";
import { updateCase } from "@/lib/api/cases";

export interface CaseState {
  template: Template | null;
  entities: Entity[];
  formData: Record<string, string>;
  caseId: string | null;
  caseStatus: Case["status"] | null;
  status: "idle" | "saving" | "generating" | "exporting" | "error";
  saveStatus: "idle" | "saving" | "saved" | "error";
  progress: number;
  loading: boolean;
  error: string | null;
  generationError: string | null;
}

export type CaseAction =
  | { type: "SET_TEMPLATE"; payload: Template }
  | { type: "UPDATE_FIELD"; payload: { entityId: string; value: string } }
  | {
      type: "SET_CASE_ID";
      payload: { caseId: string; caseStatus: Case["status"] };
    }
  | { type: "SET_STATUS"; payload: CaseState["status"] }
  | { type: "SET_SAVE_STATUS"; payload: CaseState["saveStatus"] }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_GENERATION_ERROR"; payload: string | null }
  | { type: "SET_FORM_DATA"; payload: Record<string, string> }
  | { type: "ADD_ENTITY"; payload: Entity }
  | { type: "REMOVE_ENTITY"; payload: string };

function computeProgress(
  entities: Entity[],
  formData: Record<string, string>
): number {
  if (entities.length === 0) return 0;
  const filled = entities.filter((entity) => {
    const value = formData[entity.id];
    return value !== undefined && value.trim() !== "";
  }).length;
  return Math.round((filled / entities.length) * 100);
}

export function caseReducer(
  state: CaseState,
  action: CaseAction
): CaseState {
  switch (action.type) {
    case "SET_TEMPLATE":
      return {
        ...state,
        template: action.payload,
        entities: action.payload.entities,
        formData: {},
        progress: 0,
        saveStatus: "idle",
      };
    case "UPDATE_FIELD": {
      const { entityId, value } = action.payload;
      const nextFormData = { ...state.formData };
      if (value === "") {
        delete nextFormData[entityId];
      } else {
        nextFormData[entityId] = value;
      }
      return {
        ...state,
        formData: nextFormData,
        progress: computeProgress(state.entities, nextFormData),
        saveStatus: "idle",
      };
    }
    case "SET_CASE_ID":
      return {
        ...state,
        caseId: action.payload.caseId,
        caseStatus: action.payload.caseStatus,
      };
    case "SET_STATUS":
      return { ...state, status: action.payload };
    case "SET_SAVE_STATUS":
      return { ...state, saveStatus: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "SET_GENERATION_ERROR":
      return { ...state, generationError: action.payload };
    case "SET_FORM_DATA":
      return {
        ...state,
        formData: action.payload,
        progress: computeProgress(state.entities, action.payload),
        saveStatus: "idle",
      };
    case "ADD_ENTITY": {
      const nextEntities = [...state.entities, action.payload];
      return {
        ...state,
        entities: nextEntities,
        progress: computeProgress(nextEntities, state.formData),
      };
    }
    case "REMOVE_ENTITY": {
      const nextEntities = state.entities.filter(
        (entity) => entity.id !== action.payload
      );
      const nextFormData = { ...state.formData };
      delete nextFormData[action.payload];
      return {
        ...state,
        entities: nextEntities,
        formData: nextFormData,
        progress: computeProgress(nextEntities, nextFormData),
      };
    }
    default:
      return state;
  }
}

export const initialCaseState: CaseState = {
  template: null,
  entities: [],
  formData: {},
  caseId: null,
  caseStatus: null,
  status: "idle",
  saveStatus: "idle",
  progress: 0,
  loading: false,
  error: null,
  generationError: null,
};

interface CaseContextValue {
  state: CaseState;
  dispatch: React.Dispatch<CaseAction>;
  updateField: (entityId: string, value: string) => void;
  setTemplate: (template: Template) => void;
  setCase: (caseItem: Case) => void;
  setStatus: (status: CaseState["status"]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setGenerationError: (error: string | null) => void;
  saveForm: () => Promise<void>;
  addEntity: (entity: Entity) => void;
  removeEntity: (entityId: string) => void;
}

const CaseContext = createContext<CaseContextValue | null>(null);

interface CaseProviderProps {
  readonly children: ReactNode;
  readonly initialCase?: Case | null;
}

export function CaseProvider({
  children,
  initialCase = null,
}: CaseProviderProps) {
  const [state, dispatch] = useReducer(caseReducer, initialCaseState);
  const lastSavedFormData = useRef<Record<string, string>>({});

  const updateField = useCallback((entityId: string, value: string) => {
    dispatch({ type: "UPDATE_FIELD", payload: { entityId, value } });
  }, []);

  const setTemplate = useCallback((template: Template) => {
    dispatch({ type: "SET_TEMPLATE", payload: template });
  }, []);

  const setCase = useCallback((caseItem: Case) => {
    dispatch({
      type: "SET_CASE_ID",
      payload: { caseId: caseItem.id, caseStatus: caseItem.status },
    });
    dispatch({ type: "SET_FORM_DATA", payload: caseItem.formData });
    lastSavedFormData.current = { ...caseItem.formData };
  }, []);

  const setStatus = useCallback((status: CaseState["status"]) => {
    dispatch({ type: "SET_STATUS", payload: status });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: "SET_LOADING", payload: loading });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: "SET_ERROR", payload: error });
  }, []);

  const setGenerationError = useCallback((error: string | null) => {
    dispatch({ type: "SET_GENERATION_ERROR", payload: error });
  }, []);

  const addEntity = useCallback((entity: Entity) => {
    dispatch({ type: "ADD_ENTITY", payload: entity });
  }, []);

  const removeEntity = useCallback((entityId: string) => {
    dispatch({ type: "REMOVE_ENTITY", payload: entityId });
  }, []);

  const saveForm = useCallback(async () => {
    if (!state.caseId || state.caseStatus !== "borrador") return;
    dispatch({ type: "SET_SAVE_STATUS", payload: "saving" });
    try {
      await updateCase(state.caseId, { formData: state.formData });
      lastSavedFormData.current = { ...state.formData };
      dispatch({ type: "SET_SAVE_STATUS", payload: "saved" });
    } catch (err) {
      dispatch({ type: "SET_SAVE_STATUS", payload: "error" });
      throw err;
    }
  }, [state.caseId, state.caseStatus, state.formData]);

  // Auto-save trigger every 30s when the form is dirty and case is editable
  useEffect(() => {
    if (!state.caseId || state.caseStatus !== "borrador") return;

    const isDirty =
      JSON.stringify(state.formData) !==
      JSON.stringify(lastSavedFormData.current);
    if (!isDirty) return;

    const timer = setInterval(() => {
      void saveForm();
    }, 30000);

    return () => clearInterval(timer);
  }, [state.caseId, state.caseStatus, state.formData, saveForm]);

  useEffect(() => {
    if (initialCase) {
      setCase(initialCase);
    }
  }, [initialCase, setCase]);

  return (
    <CaseContext.Provider
      value={{
        state,
        dispatch,
        updateField,
        setTemplate,
        setCase,
        setStatus,
        setLoading,
        setError,
        setGenerationError,
        saveForm,
        addEntity,
        removeEntity,
      }}
    >
      {children}
    </CaseContext.Provider>
  );
}

export function useCase(): CaseContextValue {
  const ctx = useContext(CaseContext);
  if (!ctx) {
    throw new Error("useCase must be used within a CaseProvider");
  }
  return ctx;
}
