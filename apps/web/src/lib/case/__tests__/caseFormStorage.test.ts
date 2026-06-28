import { describe, it, expect, beforeEach } from "vitest";
import {
  loadCaseFormDraft,
  saveCaseFormDraft,
  clearCaseFormDraft,
} from "../caseFormStorage";

let mockStore: Record<string, string> = {};

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
        caseId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "660e8400-e29b-41d4-a716-446655440001",
        formData: { "ent-1": "Juan Pérez" },
      });

      expect(sessionStorage.getItem("case-form-draft:v1")).not.toBeNull();

      const stored = sessionStorage.getItem("case-form-draft:v1")!;
      const parsed = JSON.parse(stored);
      expect(parsed.caseId).toBe("550e8400-e29b-41d4-a716-446655440000");
      expect(parsed.templateId).toBe("660e8400-e29b-41d4-a716-446655440001");
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
          caseId: "550e8400-e29b-41d4-a716-446655440000",
          templateId: "660e8400-e29b-41d4-a716-446655440001",
          formData: {},
        }),
      ).not.toThrow();
    });
  });

  describe("loadCaseFormDraft", () => {
    it("returns null when no draft exists", () => {
      const result = loadCaseFormDraft();
      expect(result).toBeNull();
    });

    it("loads a valid draft from sessionStorage", () => {
      const draft = {
        caseId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "660e8400-e29b-41d4-a716-446655440001",
        formData: { "ent-1": "Juan Pérez" },
        savedAt: new Date().toISOString(),
      };
      mockStore["case-form-draft:v1"] = JSON.stringify(draft);

      const result = loadCaseFormDraft();
      expect(result).not.toBeNull();
      expect(result!.caseId).toBe(draft.caseId);
      expect(result!.templateId).toBe(draft.templateId);
      expect(result!.formData).toEqual(draft.formData);
    });

    it("returns null and clears storage for invalid JSON", () => {
      mockStore["case-form-draft:v1"] = "not valid json";
      const result = loadCaseFormDraft();
      expect(result).toBeNull();
      expect(sessionStorage.getItem("case-form-draft:v1")).toBeNull();
    });

    it("returns null and clears storage for schema-violating data", () => {
      mockStore["case-form-draft:v1"] = JSON.stringify({ not: "a valid draft" });
      const result = loadCaseFormDraft();
      expect(result).toBeNull();
      expect(sessionStorage.getItem("case-form-draft:v1")).toBeNull();
    });

    it("returns null and clears storage for non-uuid caseId", () => {
      mockStore["case-form-draft:v1"] = JSON.stringify({
        caseId: "not-a-uuid",
        templateId: "660e8400-e29b-41d4-a716-446655440001",
        formData: {},
        savedAt: new Date().toISOString(),
      });
      const result = loadCaseFormDraft();
      expect(result).toBeNull();
      expect(sessionStorage.getItem("case-form-draft:v1")).toBeNull();
    });

    it("returns null when window is undefined", () => {
      Object.defineProperty(globalThis, "window", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      mockStore["case-form-draft:v1"] = JSON.stringify({
        caseId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "660e8400-e29b-41d4-a716-446655440001",
        formData: {},
        savedAt: new Date().toISOString(),
      });
      const result = loadCaseFormDraft();
      expect(result).toBeNull();
    });

    it("returns null when sessionStorage is undefined", () => {
      Object.defineProperty(globalThis, "sessionStorage", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      const result = loadCaseFormDraft();
      expect(result).toBeNull();
    });
  });

  describe("clearCaseFormDraft", () => {
    it("removes draft from sessionStorage", () => {
      saveCaseFormDraft({
        caseId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "660e8400-e29b-41d4-a716-446655440001",
        formData: { "ent-1": "Juan Pérez" },
      });

      clearCaseFormDraft();

      expect(sessionStorage.getItem("case-form-draft:v1")).toBeNull();
    });

    it("does not throw when no draft exists", () => {
      expect(() => clearCaseFormDraft()).not.toThrow();
    });

    it("does not throw when sessionStorage is undefined", () => {
      Object.defineProperty(globalThis, "sessionStorage", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(() => clearCaseFormDraft()).not.toThrow();
    });
  });

  describe("round-trip", () => {
    it("save then load returns equivalent data", () => {
      const input = {
        caseId: "550e8400-e29b-41d4-a716-446655440000",
        templateId: "660e8400-e29b-41d4-a716-446655440001",
        formData: {
          "ent-1": "Juan Pérez",
          "ent-2": "Calle Falsa 123",
        },
      };

      saveCaseFormDraft(input);
      const loaded = loadCaseFormDraft();

      expect(loaded).not.toBeNull();
      expect(loaded!.caseId).toBe(input.caseId);
      expect(loaded!.templateId).toBe(input.templateId);
      expect(loaded!.formData).toEqual(input.formData);
      expect(typeof loaded!.savedAt).toBe("string");
    });
  });
});
