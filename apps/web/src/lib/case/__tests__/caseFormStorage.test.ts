import { describe, it, expect, beforeEach } from "vitest";
import {
  loadCaseFormDraft,
  saveCaseFormDraft,
  clearCaseFormDraft,
} from "../caseFormStorage";

let mockStore: Record<string, string> = {};

const CASE_ID = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_CASE_ID = "770e8400-e29b-41d4-a716-446655440002";
const TEMPLATE_ID = "660e8400-e29b-41d4-a716-446655440001";
const DRAFT_KEY = `case-form-draft:v1:${CASE_ID}`;

beforeEach(() => {
  mockStore = {};
  Object.defineProperty(globalThis, "window", {
    value: {},
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    value: {
      getItem: (key: string) => mockStore[key] ?? null,
      setItem: (key: string, value: string) => {
        mockStore[key] = value;
      },
      removeItem: (key: string) => {
        delete mockStore[key];
      },
      clear: () => {
        mockStore = {};
      },
    },
    writable: true,
    configurable: true,
  });
});

describe("caseFormStorage", () => {
  describe("saveCaseFormDraft", () => {
    it("saves a valid draft to sessionStorage", () => {
      saveCaseFormDraft({
        caseId: CASE_ID,
        templateId: TEMPLATE_ID,
        formData: { "ent-1": "Juan Pérez" },
      });

      expect(sessionStorage.getItem(DRAFT_KEY)).not.toBeNull();

      const stored = sessionStorage.getItem(DRAFT_KEY)!;
      const parsed = JSON.parse(stored);
      expect(parsed.caseId).toBe(CASE_ID);
      expect(parsed.templateId).toBe(TEMPLATE_ID);
      expect(parsed.formData).toEqual({ "ent-1": "Juan Pérez" });
      expect(typeof parsed.savedAt).toBe("string");
    });

    it("does not throw when sessionStorage setItem throws", () => {
      Object.defineProperty(globalThis, "sessionStorage", {
        value: {
          getItem: () => null,
          setItem: () => {
            throw new Error("QuotaExceededError");
          },
          removeItem: () => {},
        },
        writable: true,
        configurable: true,
      });

      expect(() =>
        saveCaseFormDraft({
          caseId: CASE_ID,
          templateId: TEMPLATE_ID,
          formData: {},
        }),
      ).not.toThrow();
    });
  });

  describe("loadCaseFormDraft", () => {
    it("returns null when no draft exists", () => {
      const result = loadCaseFormDraft(CASE_ID);
      expect(result).toBeNull();
    });

    it("loads a valid draft from sessionStorage", () => {
      const draft = {
        caseId: CASE_ID,
        templateId: TEMPLATE_ID,
        formData: { "ent-1": "Juan Pérez" },
        savedAt: new Date().toISOString(),
      };
      mockStore[DRAFT_KEY] = JSON.stringify(draft);

      const result = loadCaseFormDraft(CASE_ID);
      expect(result).not.toBeNull();
      expect(result!.caseId).toBe(draft.caseId);
      expect(result!.templateId).toBe(draft.templateId);
      expect(result!.formData).toEqual(draft.formData);
    });

    it("returns null and clears storage for invalid JSON", () => {
      mockStore[DRAFT_KEY] = "not valid json";
      const result = loadCaseFormDraft(CASE_ID);
      expect(result).toBeNull();
      expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it("returns null and clears storage for schema-violating data", () => {
      mockStore[DRAFT_KEY] = JSON.stringify({ not: "a valid draft" });
      const result = loadCaseFormDraft(CASE_ID);
      expect(result).toBeNull();
      expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it("returns null and clears storage for non-uuid caseId", () => {
      const invalidKey = `case-form-draft:v1:not-a-uuid`;
      mockStore[invalidKey] = JSON.stringify({
        caseId: "not-a-uuid",
        templateId: TEMPLATE_ID,
        formData: {},
        savedAt: new Date().toISOString(),
      });
      const result = loadCaseFormDraft("not-a-uuid");
      expect(result).toBeNull();
      expect(sessionStorage.getItem(invalidKey)).toBeNull();
    });

    it("returns null when window is undefined", () => {
      Object.defineProperty(globalThis, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      mockStore[DRAFT_KEY] = JSON.stringify({
        caseId: CASE_ID,
        templateId: TEMPLATE_ID,
        formData: {},
        savedAt: new Date().toISOString(),
      });
      const result = loadCaseFormDraft(CASE_ID);
      expect(result).toBeNull();
    });

    it("returns null when sessionStorage is undefined", () => {
      Object.defineProperty(globalThis, "sessionStorage", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      const result = loadCaseFormDraft(CASE_ID);
      expect(result).toBeNull();
    });
  });

  describe("clearCaseFormDraft", () => {
    it("removes draft from sessionStorage", () => {
      saveCaseFormDraft({
        caseId: CASE_ID,
        templateId: TEMPLATE_ID,
        formData: { "ent-1": "Juan Pérez" },
      });

      clearCaseFormDraft(CASE_ID);

      expect(sessionStorage.getItem(DRAFT_KEY)).toBeNull();
    });

    it("does not throw when no draft exists", () => {
      expect(() => clearCaseFormDraft(CASE_ID)).not.toThrow();
    });

    it("does not throw when sessionStorage is undefined", () => {
      Object.defineProperty(globalThis, "sessionStorage", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(() => clearCaseFormDraft(CASE_ID)).not.toThrow();
    });
  });

  describe("round-trip", () => {
    it("save then load returns equivalent data", () => {
      const input = {
        caseId: CASE_ID,
        templateId: TEMPLATE_ID,
        formData: {
          "ent-1": "Juan Pérez",
          "ent-2": "Calle Falsa 123",
        },
      };

      saveCaseFormDraft(input);
      const loaded = loadCaseFormDraft(CASE_ID);

      expect(loaded).not.toBeNull();
      expect(loaded!.caseId).toBe(input.caseId);
      expect(loaded!.templateId).toBe(input.templateId);
      expect(loaded!.formData).toEqual(input.formData);
      expect(typeof loaded!.savedAt).toBe("string");
    });
  });
});
