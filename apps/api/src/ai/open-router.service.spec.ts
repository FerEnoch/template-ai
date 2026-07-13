import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "@nestjs/common";
import { OpenRouterService, OpenRouterError } from "./open-router.service.js";
import type { CachePort } from "../infrastructure/redis/index.js";
import { PromptEngine } from "./prompt-engine.js";
import { resolveModelChain } from "./model-router.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      public chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

vi.mock("./model-router.js", () => ({
  resolveModelChain: vi.fn(),
}));

vi.mock("../config/ai.js", () => ({
  AI_CONFIG: {
    model: "test-model",
    modelFallback: undefined,
    apiKey: "test-api-key",
    maxTokens: 8192,
    temperature: 0.1,
  },
  AI_GENERATION_CONFIG: {
    maxTokens: 8192,
    temperature: 0.1,
  },
  CACHE_CONFIG: {
    enabled: false,
    responseCacheTtl: 604800,
    textCacheTtl: 604800,
    maxEntryBytes: 1048576,
  },
  UPLOAD_DIR: "/tmp/test-uploads",
}));

function createMockCachePort(): CachePort {
  return {
    get: vi.fn(async () => null),
    set: vi.fn(async () => {}),
    getOrSet: vi.fn(
      async <T,>(
        _key: string,
        _ttl: number,
        factory: () => Promise<T>,
      ): Promise<T> => factory(),
    ),
  } as CachePort;
}

function createMockPromptEngine(): PromptEngine {
  return {
    load: vi.fn(async (name: string) => `loaded:${name}`),
    render: vi.fn((template: string, vars: Record<string, string>) =>
      template.replace(/\{\{(\w+)\}\}/g, (_match, key) => vars[key] ?? ""),
    ),
    renderWithSafety: vi.fn(async (_task: string, vars: Record<string, string>) =>
      `safety\nrendered:${JSON.stringify(vars)}`,
    ),
  } as unknown as PromptEngine;
}

function rateLimitError(model: string): Error {
  const error = new Error(`Rate limit: ${model}`);
  Object.defineProperty(error, "status", { value: 429 });
  return error;
}

function modelNotFoundError(model: string): Error {
  const error = new Error(`Not found: ${model}`);
  Object.defineProperty(error, "status", { value: 404 });
  return error;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OpenRouterService", () => {
  let service: OpenRouterService;
  let mockCachePort: CachePort;
  let mockPromptEngine: PromptEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCachePort = createMockCachePort();
    mockPromptEngine = createMockPromptEngine();
    service = new OpenRouterService(mockCachePort, mockPromptEngine);
  });

  describe("extractEntities", () => {
    it("should use PromptEngine and ModelRouter for extraction", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["primary-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue(
        "rendered extraction prompt",
      );

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ entities: [] }),
            },
          },
        ],
      });

      await service.extractEntities({
        documentText: "Contrato de compra...",
        userId: 1,
        groups: ["PARTES", "INMUEBLE"],
        fewShot: "ejemplo",
      });

      expect(resolveModelChain).toHaveBeenCalledWith("extraction");
      expect(mockPromptEngine.renderWithSafety).toHaveBeenCalledWith(
        "extraction",
        expect.objectContaining({
          documentText: "Contrato de compra...",
          groups: expect.stringContaining("PARTES"),
          fewShot: "ejemplo",
        }),
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "primary-model",
          messages: [
            { role: "system", content: "rendered extraction prompt" },
            { role: "user", content: expect.any(String) },
          ],
        }),
      );
    });

    it("should extract valid entities from a successful response", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["test-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      const entities = [
        {
          label: "COMPRADOR",
          value: "Juan Pérez",
          group: "PARTES",
          confidence: "ALTA",
        },
        {
          label: "PRECIO_TOTAL",
          value: "$2,000,000 MXN",
          group: "INMUEBLE",
          confidence: "MEDIA",
        },
      ];

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ entities }),
            },
          },
        ],
      });

      const result = await service.extractEntities({
        documentText: "Contrato de compra...",
        userId: 1,
        groups: ["PARTES", "INMUEBLE"],
      });

      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].label).toBe("COMPRADOR");
      expect(result.entities[1].label).toBe("PRECIO_TOTAL");
      expect(result.rawResponse).toBe(JSON.stringify({ entities }));
    });

    it("should accept arbitrary group names after widening the schema", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["test-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      const entities = [
        {
          label: "CAMPO_CUSTOM",
          value: "valor",
          group: "CUSTOM_GROUP",
          confidence: "ALTA",
        },
      ];

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ entities }),
            },
          },
        ],
      });

      const result = await service.extractEntities({
        documentText: "doc",
        userId: 1,
        groups: ["CUSTOM_GROUP"],
      });

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].group).toBe("CUSTOM_GROUP");
    });

    it("should parse suggestedGroups from the AI response", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["test-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                entities: [],
                suggestedGroups: ["GARANTES", "OBLIGACIONES"],
              }),
            },
          },
        ],
      });

      const result = await service.extractEntities({
        documentText: "doc",
        userId: 1,
        groups: ["PARTES"],
      });

      expect(result.suggestedGroups).toEqual(["GARANTES", "OBLIGACIONES"]);
    });

    it("should ignore invalid suggestedGroups entries", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["test-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                entities: [],
                suggestedGroups: ["VALID", 123, ""],
              }),
            },
          },
        ],
      });

      const result = await service.extractEntities({
        documentText: "doc",
        userId: 1,
        groups: ["PARTES"],
      });

      expect(result.suggestedGroups).toEqual(["VALID"]);
    });

    it("should include sourceSpan when provided by AI", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["test-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      const entities = [
        {
          label: "COMPRADOR",
          value: "Juan Pérez",
          group: "PARTES",
          confidence: "ALTA",
          sourceSpan: { start: 34, end: 43 },
        },
      ];

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ entities }),
            },
          },
        ],
      });

      const result = await service.extractEntities({
        documentText: "some text",
        userId: 1,
        groups: ["PARTES"],
      });

      expect(result.entities[0].sourceSpan).toEqual({ start: 34, end: 43 });
    });

    it("should filter invalid entities and keep valid ones on Zod partial failure", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["test-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      const entities = [
        {
          label: "COMPRADOR",
          value: "Juan Pérez",
          group: "PARTES",
          confidence: "ALTA",
        },
        { label: "BAD_GROUP", value: "something", group: "", confidence: "ALTA" },
        { label: "BAD_CONFIDENCE", value: "other", group: "INMUEBLE", confidence: "INVALID" },
      ];

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ entities }),
            },
          },
        ],
      });

      const result = await service.extractEntities({
        documentText: "some text",
        userId: 1,
        groups: ["PARTES", "INMUEBLE"],
      });

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].label).toBe("COMPRADOR");
    });

    it("should throw OpenRouterError when all entities fail Zod validation", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["test-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      const entities = [{ label: "BAD", value: "x", group: "", confidence: "NOPE" }];

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ entities }),
            },
          },
        ],
      });

      await expect(
        service.extractEntities({ documentText: "text", userId: 1, groups: ["PARTES"] }),
      ).rejects.toThrow(OpenRouterError);
    });

    it("should throw OpenRouterError with AUTH_ERROR on 401 status", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["test-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      const error = new Error("Unauthorized");
      Object.defineProperty(error, "status", { value: 401 });
      mockCreate.mockRejectedValue(error);

      await expect(
        service.extractEntities({ documentText: "text", userId: 1, groups: ["PARTES"] }),
      ).rejects.toThrow(OpenRouterError);
    });

    it("should throw OpenRouterError with MODEL_NOT_FOUND on 404 status", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["test-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      const error = new Error("Not found");
      Object.defineProperty(error, "status", { value: 404 });
      mockCreate.mockRejectedValue(error);

      await expect(
        service.extractEntities({ documentText: "text", userId: 1, groups: ["PARTES"] }),
      ).rejects.toThrow(OpenRouterError);
    });

    it("should throw OpenRouterError with RATE_LIMIT on 429 status", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["test-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      const error = new Error("Too many requests");
      Object.defineProperty(error, "status", { value: 429 });
      mockCreate.mockRejectedValue(error);

      await expect(
        service.extractEntities({ documentText: "text", userId: 1, groups: ["PARTES"] }),
      ).rejects.toThrow(OpenRouterError);
    });

    it("should throw OpenRouterError with NETWORK_ERROR on generic error", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["test-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      mockCreate.mockRejectedValue(new Error("Connection refused"));

      await expect(
        service.extractEntities({ documentText: "text", userId: 1, groups: ["PARTES"] }),
      ).rejects.toThrow(OpenRouterError);
    });

    it("should throw INVALID_RESPONSE on malformed JSON (truncated)", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["test-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '{"entities": [{"label": "COMPRADOR", "value": "Juan',
            },
          },
        ],
      });

      await expect(
        service.extractEntities({ documentText: "text", userId: 1, groups: ["PARTES"] }),
      ).rejects.toThrow(OpenRouterError);
    });

    it("should parse JSON wrapped in markdown fences", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["test-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      const entities = [
        { label: "COMPRADOR", value: "Juan Pérez", group: "PARTES", confidence: "ALTA" },
      ];

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "```json\n" + JSON.stringify({ entities }) + "\n```",
            },
          },
        ],
      });

      const result = await service.extractEntities({
        documentText: "text",
        userId: 1,
        groups: ["PARTES"],
      });

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].label).toBe("COMPRADOR");
    });

    it("should throw INVALID_RESPONSE when given plain non-JSON text", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["test-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "Lo siento, no puedo procesar este documento.",
            },
          },
        ],
      });

      await expect(
        service.extractEntities({ documentText: "text", userId: 1, groups: ["PARTES"] }),
      ).rejects.toThrow(OpenRouterError);
    });

    it("should throw INVALID_RESPONSE for SyntaxError from any code path", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["test-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      const syntaxErr = new SyntaxError("Unexpected token");
      mockCreate.mockRejectedValue(syntaxErr);

      await expect(
        service.extractEntities({ documentText: "text", userId: 1, groups: ["PARTES"] }),
      ).rejects.toThrow(OpenRouterError);
    });
  });

  describe("callWithRetryChain", () => {
    it("should retry primary model 3 times then fallback once on RATE_LIMIT", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["primary-model", "fallback-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      mockCreate
        .mockRejectedValueOnce(rateLimitError("primary-model"))
        .mockRejectedValueOnce(rateLimitError("primary-model"))
        .mockRejectedValueOnce(rateLimitError("primary-model"))
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify({ entities: [] }),
              },
            },
          ],
        });

      await service.extractEntities({
        documentText: "text",
        userId: 1,
        groups: ["PARTES"],
      });

      expect(mockCreate).toHaveBeenCalledTimes(4);
      expect(mockCreate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ model: "primary-model" }),
      );
      expect(mockCreate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ model: "primary-model" }),
      );
      expect(mockCreate).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ model: "primary-model" }),
      );
      expect(mockCreate).toHaveBeenNthCalledWith(
        4,
        expect.objectContaining({ model: "fallback-model" }),
      );
    });

    it("should move to fallback immediately on MODEL_NOT_FOUND", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["missing-model", "fallback-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      mockCreate
        .mockRejectedValueOnce(modelNotFoundError("missing-model"))
        .mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify({ entities: [] }),
              },
            },
          ],
        });

      await service.extractEntities({
        documentText: "text",
        userId: 1,
        groups: ["PARTES"],
      });

      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(mockCreate).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ model: "missing-model" }),
      );
      expect(mockCreate).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ model: "fallback-model" }),
      );
    });

    it("should throw after exhausting the full chain", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["primary-model", "fallback-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      mockCreate
        .mockRejectedValueOnce(rateLimitError("primary-model"))
        .mockRejectedValueOnce(rateLimitError("primary-model"))
        .mockRejectedValueOnce(rateLimitError("primary-model"))
        .mockRejectedValueOnce(rateLimitError("fallback-model"));

      await expect(
        service.extractEntities({ documentText: "text", userId: 1, groups: ["PARTES"] }),
      ).rejects.toThrow(OpenRouterError);

      expect(mockCreate).toHaveBeenCalledTimes(4);
    });

    it("should not retry or fallback on AUTH_ERROR", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["primary-model", "fallback-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      const error = new Error("Unauthorized");
      Object.defineProperty(error, "status", { value: 401 });
      mockCreate.mockRejectedValueOnce(error);

      await expect(
        service.extractEntities({ documentText: "text", userId: 1, groups: ["PARTES"] }),
      ).rejects.toThrow(OpenRouterError);

      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe("classifySpan", () => {
    it("should use PromptEngine and ModelRouter for classification", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["classify-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue(
        "rendered classification prompt",
      );

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                label: "ARRENDATARIO",
                group: "PARTES",
                value: "Juan Pérez",
              }),
            },
          },
        ],
      });

      const result = await service.classifySpan(
        "Juan Pérez",
        "...entre Juan Pérez y María López...",
      );

      expect(resolveModelChain).toHaveBeenCalledWith("classification");
      expect(mockPromptEngine.renderWithSafety).toHaveBeenCalledWith(
        "classification",
        expect.objectContaining({
          span: "Juan Pérez",
          context: "...entre Juan Pérez y María López...",
          groups: expect.any(String),
        }),
      );
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "classify-model",
          messages: [
            { role: "system", content: "rendered classification prompt" },
            { role: "user", content: expect.any(String) },
          ],
        }),
      );
      expect(result).toEqual({
        label: "ARRENDATARIO",
        group: "PARTES",
        value: "Juan Pérez",
      });
    });

    it("should use temperature 0 and max_tokens 150", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["classify-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                label: "FECHA",
                group: "FECHAS",
                value: "20 de marzo de 2026",
              }),
            },
          },
        ],
      });

      await service.classifySpan("20 de marzo de 2026", "firmado el 20 de marzo de 2026");

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0,
          max_tokens: 150,
        }),
      );
    });

    it("should parse JSON wrapped in markdown fences", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["classify-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content:
                '```json\n{"label": "PRECIO", "group": "INMUEBLE", "value": "$2,000,000"}\n```',
            },
          },
        ],
      });

      const result = await service.classifySpan(
        "$2,000,000",
        "por un precio de $2,000,000",
      );

      expect(result).toEqual({
        label: "PRECIO",
        group: "INMUEBLE",
        value: "$2,000,000",
      });
    });

    it("should throw OpenRouterError with INVALID_RESPONSE on malformed JSON", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["classify-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "I cannot classify this text.",
            },
          },
        ],
      });

      await expect(service.classifySpan("some text", "context")).rejects.toThrow(
        OpenRouterError,
      );
    });

    it("should throw OpenRouterError with INVALID_RESPONSE on invalid group", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["classify-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                label: "FIELD",
                group: "",
                value: "some value",
              }),
            },
          },
        ],
      });

      await expect(service.classifySpan("some text", "context")).rejects.toThrow(
        OpenRouterError,
      );
    });

    it("should throw NETWORK_ERROR on connection failure", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["classify-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      mockCreate.mockRejectedValue(new Error("Connection refused"));

      await expect(service.classifySpan("text", "context")).rejects.toThrow(OpenRouterError);
    });
  });

  describe("generateDocument", () => {
    it("should use PromptEngine and ModelRouter for generation", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["gen-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue(
        "rendered generation prompt",
      );

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ generatedText: "generated document" }),
            },
          },
        ],
      });

      const result = await service.generateDocument("generation", {
        entities: "ent-1: foo",
        formData: "form-1: bar",
        baseText: "base text",
      });

      expect(resolveModelChain).toHaveBeenCalledWith("generation");
      expect(mockPromptEngine.renderWithSafety).toHaveBeenCalledWith("generation", {
        entities: "ent-1: foo",
        formData: "form-1: bar",
        baseText: "base text",
      });
      expect(result.generatedText).toBe("generated document");
    });

    it("should use generation-no-base task when requested", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["gen-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ generatedText: "generated" }),
            },
          },
        ],
      });

      await service.generateDocument("generation-no-base", {
        entities: "ent",
        formData: "form",
      });

      expect(mockPromptEngine.renderWithSafety).toHaveBeenCalledWith("generation-no-base", {
        entities: "ent",
        formData: "form",
      });
    });

    it("should throw when generatedText is missing", async () => {
      vi.mocked(resolveModelChain).mockReturnValue(["gen-model"]);
      vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({}) } }],
      });

      await expect(
        service.generateDocument("generation", { entities: "ent", formData: "form" }),
      ).rejects.toThrow(OpenRouterError);
    });
  });

  describe("generateDocument structured error logging", () => {
    const vars = { entities: "ent", formData: "form", baseText: "base" };
    let loggerErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      loggerErrorSpy = vi
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => undefined);
    });

    afterEach(() => {
      loggerErrorSpy.mockRestore();
    });

    it.each([
      { status: 401, body: "auth failure", code: "AUTH_ERROR" },
      { status: 404, body: "model missing", code: "MODEL_NOT_FOUND" },
      { status: 429, body: "rate limited", code: "RATE_LIMIT" },
      { status: 500, body: "server error body fragment", code: "API_ERROR" },
      { status: 0, body: undefined, code: "NETWORK_ERROR" },
    ])(
      "logs status $status and body fragment before throwing $code",
      async ({ status, body, code }) => {
        vi.mocked(resolveModelChain).mockReturnValue(["gen-model"]);
        vi.mocked(mockPromptEngine.renderWithSafety).mockResolvedValue("prompt");

        const error = new Error("OpenAI error");
        Object.defineProperty(error, "status", { value: status });
        if (body !== undefined) {
          Object.defineProperty(error, "body", { value: body });
        }
        mockCreate.mockRejectedValue(error);

        await expect(service.generateDocument("generation", vars)).rejects.toThrow(
          OpenRouterError,
        );

        expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
        const log = loggerErrorSpy.mock.calls[0]![0] as string;

        expect(log).toContain(`status=${status}`);
        if (body !== undefined) {
          expect(log).toContain(body.slice(0, 30));
          expect(log.length).toBeLessThanOrEqual(200);
        }
      },
    );
  });
});
