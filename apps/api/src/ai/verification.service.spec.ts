import { describe, expect, it, vi, beforeEach } from "vitest";
import { VerificationService } from "./verification.service.js";
import { PromptEngine } from "./prompt-engine.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: class MockOpenAI {
    public chat = {
      completions: {
        create: mockCreate,
      },
    };
  },
}));

vi.mock("../config/ai.js", () => ({
  AI_CONFIG: {
    model: "test-model",
    modelFallback: "test-fallback",
    apiKey: "test-api-key",
    maxTokens: 8192,
    temperature: 0.1,
  },
}));

function createMockPromptEngine(): PromptEngine {
  return {
    load: vi.fn(async (name: string) => `loaded:${name}`),
    render: vi.fn((template: string, vars: Record<string, string>) =>
      template.replace(/\{\{(\w+)\}\}/g, (_match, key) => vars[key] ?? ""),
    ),
    renderWithSafety: vi.fn(
      async (_task: string, vars: Record<string, string>) =>
        `safety\nverification:${vars.generatedText ?? ""}`,
    ),
  } as unknown as PromptEngine;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VerificationService", () => {
  let service: VerificationService;
  let mockPromptEngine: PromptEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPromptEngine = createMockPromptEngine();
    service = new VerificationService(mockPromptEngine);
  });

  describe("verify", () => {
    it("returns passed:true for a clean document", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                passed: true,
                completarCount: 0,
                warnings: [],
              }),
            },
          },
        ],
      });

      const result = await service.verify("Este es un documento completo.");

      expect(result).toEqual({
        passed: true,
        completarCount: 0,
        warnings: [],
      });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "test-fallback",
          max_tokens: 2048,
          temperature: 0,
          messages: expect.arrayContaining([
            expect.objectContaining({ role: "system" }),
            expect.objectContaining({ role: "user" }),
          ]),
        }),
      );
      expect(mockPromptEngine.renderWithSafety).toHaveBeenCalledWith(
        "verification",
        { generatedText: "Este es un documento completo." },
      );
    });

    it("flags documents containing unresolved [COMPLETAR] markers", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                passed: false,
                completarCount: 2,
                warnings: ["Falta nombre del arrendador", "Falta monto de renta"],
              }),
            },
          },
        ],
      });

      const result = await service.verify(
        "El Sr. [COMPLETAR] domiciliado en [COMPLETAR].",
      );

      expect(result.passed).toBe(false);
      expect(result.completarCount).toBe(2);
      expect(result.warnings).toEqual([
        "Falta nombre del arrendador",
        "Falta monto de renta",
      ]);
    });

    it("uses AI_MODEL when AI_MODEL_FALLBACK is not configured", async () => {
      const { AI_CONFIG } = (await import("../config/ai.js")) as {
        AI_CONFIG: { model?: string; modelFallback?: string };
      };
      AI_CONFIG.modelFallback = undefined;

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                passed: true,
                completarCount: 0,
                warnings: [],
              }),
            },
          },
        ],
      });

      await service.verify("Documento.");

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "test-model" }),
      );
    });

    it("degrades gracefully when the model call fails", async () => {
      mockCreate.mockRejectedValue(new Error("OpenRouter timeout"));

      const result = await service.verify(
        "El Sr. [COMPLETAR] domiciliado en.",
      );

      expect(result.passed).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.completarCount).toBe(1);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toMatch(/verification model failed/i);
      expect(result.warnings).toContain(
        "Detected 1 unresolved [COMPLETAR] marker(s).",
      );
    });

    it("degrades gracefully when the response is invalid JSON", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: "not-json" } }],
      });

      const result = await service.verify("Texto.");

      expect(result.passed).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("degrades gracefully when the response has an invalid shape", async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ foo: "bar" }) } }],
      });

      const result = await service.verify("Texto.");

      expect(result.passed).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("degrades gracefully when no model is configured", async () => {
      const { AI_CONFIG } = (await import("../config/ai.js")) as {
        AI_CONFIG: { model?: string; modelFallback?: string };
      };
      AI_CONFIG.model = undefined;
      AI_CONFIG.modelFallback = undefined;

      const result = await service.verify("Texto.");

      expect(result.passed).toBe(true);
      expect(result.degraded).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});
