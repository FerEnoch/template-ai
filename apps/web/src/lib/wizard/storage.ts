import {
  WizardDraftSchema,
  type WizardDraft,
} from "@template-ai/contracts";

const DRAFT_KEY = "template-draft:v1";

/**
 * Load a draft from localStorage.
 * Returns null if no draft exists or validation fails.
 */
export function loadDraft(): WizardDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return WizardDraftSchema.parse(parsed);
  } catch {
    // Invalid or missing — clear and return null
    localStorage.removeItem(DRAFT_KEY);
    return null;
  }
}

/**
 * Save a draft to localStorage.
 * The draft must match the WizardDraft shape.
 */
export function saveDraft(
  file: WizardDraft["file"],
  analysisResultId?: string,
  entities?: WizardDraft["entities"],
  templateForm?: WizardDraft["templateForm"]
): void {
  if (typeof window === "undefined") return;

  const draft: WizardDraft = {
    version: 1 as const,
    file,
    analysisResultId,
    entities,
    templateForm,
    savedAt: new Date().toISOString(),
  };

  // Validate before storing
  const validated = WizardDraftSchema.parse(draft);
  localStorage.setItem(DRAFT_KEY, JSON.stringify(validated));
}

/**
 * Clear the draft from localStorage.
 */
export function clearDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
}