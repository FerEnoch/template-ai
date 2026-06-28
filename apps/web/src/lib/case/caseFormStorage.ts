import {
  CaseFormDraftSchema,
  type CaseFormDraft,
} from "@template-ai/contracts";

const DRAFT_KEY = "case-form-draft:v1";

export interface SaveCaseFormDraftInput {
  caseId: string;
  templateId: string;
  formData: Record<string, string>;
}

/**
 * Load a case form draft from sessionStorage.
 * Returns null if no draft exists or validation fails.
 */
export function loadCaseFormDraft(): CaseFormDraft | null {
  if (typeof window === "undefined") return null;
  if (typeof sessionStorage === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return CaseFormDraftSchema.parse(parsed);
  } catch {
    // Invalid or missing — clear and return null
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Ignore cleanup failures
    }
    return null;
  }
}

/**
 * Save a case form draft to sessionStorage.
 * The draft must match the CaseFormDraft shape.
 */
export function saveCaseFormDraft(input: SaveCaseFormDraftInput): void {
  if (typeof window === "undefined") return;
  if (typeof sessionStorage === "undefined") return;

  const draft: CaseFormDraft = {
    caseId: input.caseId,
    templateId: input.templateId,
    formData: input.formData,
    savedAt: new Date().toISOString(),
  };

  try {
    // Validate before storing
    const validated = CaseFormDraftSchema.parse(draft);
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(validated));
  } catch {
    // Storage failures (quota, disabled storage) degrade silently
  }
}

/**
 * Clear the case form draft from sessionStorage.
 */
export function clearCaseFormDraft(): void {
  if (typeof window === "undefined") return;
  if (typeof sessionStorage === "undefined") return;

  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore cleanup failures
  }
}
