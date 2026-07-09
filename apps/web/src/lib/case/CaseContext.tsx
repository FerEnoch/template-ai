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
import {
  loadCaseFormDraft,
  saveCaseFormDraft,
  clearCaseFormDraft,
} from "./caseFormStorage";

export interface CaseState {
  template: Template | null;
  entities: Entity[];
  formData: Record<string, string>;
  caseId: string | null;
  caseStatus: Case["status"] | null;
  caseName: string | null;
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
  | { type: "SET_CASE_NAME"; payload: string | null }
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
    case "SET_CASE_NAME":
      return { ...state, caseName: action.payload };
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
  caseName: null,
  status: "idle",
  saveStatus: "idle",
  progress: 0,
  loading: false,
  error: null,
  generationError: null,
};

export interface CaseContextValue {
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
  clearDraft: (caseId: string) => void;
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
  const lastHydratedCaseId = useRef<string | null>(null);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipWriteAfterSetCase = useRef(false);

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
    dispatch({ type: "SET_CASE_NAME", payload: caseItem.name ?? null });
    lastSavedFormData.current = { ...caseItem.formData };
    skipWriteAfterSetCase.current = true;
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

  const clearDraft = useCallback((caseId: string) => {
    if (writeTimer.current) {
      clearTimeout(writeTimer.current);
      writeTimer.current = null;
    }
    clearCaseFormDraft(caseId);
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

  // Hydrate formData from sessionStorage when a case is set
  useEffect(() => {
    if (!state.caseId || !state.template) return;
    if (lastHydratedCaseId.current === state.caseId) return;

    lastHydratedCaseId.current = state.caseId;
    const draft = loadCaseFormDraft(state.caseId);
    if (!draft || draft.caseId !== state.caseId) return;

    const validEntityIds = new Set(state.template.entities.map((e) => e.id));
    const filteredDraftFormData = Object.fromEntries(
      Object.entries(draft.formData).filter(([key]) => validEntityIds.has(key))
    );

    dispatch({
      type: "SET_FORM_DATA",
      payload: { ...state.formData, ...filteredDraftFormData },
    });
  }, [state.caseId, state.template]);

  // Debounced write to sessionStorage on formData change
  useEffect(() => {
    if (!state.caseId || !state.template) return;

    if (skipWriteAfterSetCase.current) {
      skipWriteAfterSetCase.current = false;
      return;
    }

    const caseId = state.caseId;
    const templateId = state.template.id;
    const formData = state.formData;

    if (writeTimer.current) {
      clearTimeout(writeTimer.current);
    }

    writeTimer.current = setTimeout(() => {
      saveCaseFormDraft({
        caseId,
        templateId,
        formData,
      });
    }, 300);

    return () => {
      if (writeTimer.current) {
        clearTimeout(writeTimer.current);
      }
    };
  }, [state.caseId, state.template, state.formData]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (writeTimer.current) {
        clearTimeout(writeTimer.current);
      }
    };
  }, []);

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
        clearDraft,
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
