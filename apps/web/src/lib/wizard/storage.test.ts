import { describe, it, expect, beforeEach } from "vitest";
import { loadDraft, saveDraft, clearDraft } from "./storage";

// Use Vitest's spyOn for reliable localStorage mocking
// Store as let so we can reset between tests
let mockStore: Record<string, string> = {};

beforeEach(() => {
  mockStore = {};
  // Make window appear defined so storage.ts doesn't early-return
  Object.defineProperty(globalThis, "window", {
    value: {},
    writable: true,
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
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

describe("storage", () => {
  describe("saveDraft", () => {
    it("saves a valid draft to localStorage", () => {
      const file = { name: "contract.pdf", size: 1024, type: "application/pdf" };
      saveDraft(file, "550e8400-e29b-41d4-a716-446655440001", [], {
        name: "Test",
        description: "Desc",
        category: "Contratos",
      });

      expect(localStorage.getItem("template-draft:v1")).not.toBeNull();

      const stored = localStorage.getItem("template-draft:v1")!;
      const parsed = JSON.parse(stored);
      expect(parsed.version).toBe(1);
      expect(parsed.file).toEqual(file);
      expect(parsed.analysisResultId).toBe("550e8400-e29b-41d4-a716-446655440001");
    });

    it("saves minimal draft with only file", () => {
      const file = { name: "minimal.pdf", size: 512, type: "application/pdf" };
      saveDraft(file);

      const stored = localStorage.getItem("template-draft:v1")!;
      const parsed = JSON.parse(stored);
      expect(parsed.file).toEqual(file);
    });
  });

  describe("loadDraft", () => {
    it("returns null when no draft exists", () => {
      mockStore["template-draft:v1"] = "";
      const result = loadDraft();
      expect(result).toBeNull();
    });

    it("loads a valid draft from localStorage", () => {
      const draft = {
        version: 1 as const,
        file: { name: "contract.pdf", size: 2048, type: "application/pdf" },
        analysisResultId: "550e8400-e29b-41d4-a716-446655440002",
        entities: [] as never[],
        templateForm: {
          name: "Test",
          description: "Description",
          category: "Contratos",
        },
        savedAt: new Date().toISOString(),
      };
      mockStore["template-draft:v1"] = JSON.stringify(draft);

      const result = loadDraft();
      expect(result).not.toBeNull();
      expect(result!.file.name).toBe("contract.pdf");
      expect(result!.analysisResultId).toBe("550e8400-e29b-41d4-a716-446655440002");
    });

    it("returns null and clears storage for invalid data", () => {
      mockStore["template-draft:v1"] = "not valid json";
      const result = loadDraft();
      expect(result).toBeNull();
      expect(localStorage.getItem("template-draft:v1")).toBeNull();
    });

    it("returns null and clears storage for schema-violating data", () => {
      mockStore["template-draft:v1"] = JSON.stringify({ not: "a valid draft" });
      const result = loadDraft();
      expect(result).toBeNull();
    });
  });

  describe("clearDraft", () => {
    it("removes draft from localStorage", () => {
      const file = { name: "contract.pdf", size: 1024, type: "application/pdf" };
      saveDraft(file);

      clearDraft();

      expect(localStorage.getItem("template-draft:v1")).toBeNull();
    });

    it("does not throw when no draft exists", () => {
      expect(() => clearDraft()).not.toThrow();
    });
  });

  describe("round-trip", () => {
    it("save then load returns equivalent data", () => {
      const file = { name: "roundtrip.pdf", size: 3333, type: "application/pdf" };
const entities = [
         {
           id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
           label: "COMPRADOR",
           value: "María González",
           group: "PARTES" as const,
           confidence: "ALTA" as const,
           sourceSpan: { start: 10, end: 25 },
           reviewed: false,
           excluded: false,
         },
       ];
      const templateForm = {
        name: "Roundtrip",
        description: "Testing roundtrip",
        category: "Contratos",
      };

      saveDraft(file, "550e8400-e29b-41d4-a716-446655440003", entities, templateForm);
      const loaded = loadDraft();

      expect(loaded).not.toBeNull();
      expect(loaded!.file).toEqual(file);
      expect(loaded!.analysisResultId).toBe("550e8400-e29b-41d4-a716-446655440003");
      expect(loaded!.entities).toEqual(entities);
    });
  });
});