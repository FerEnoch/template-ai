import { describe, expect, it, vi, beforeEach } from "vitest";
import { OpenRouterService, OpenRouterError } from "./open-router.service.js";

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

vi.mock("../config/ai.js", () => ({
  AI_CONFIG: {
    model: "test-model",
    modelFallback: undefined,
    apiKey: "test-api-key",
    maxTokens: 8192,
    temperature: 0.1,
  },
  UPLOAD_DIR: "/tmp/test-uploads",
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("OpenRouterService", () => {
  let service: OpenRouterService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OpenRouterService();
  });

  describe("extractEntities", () => {
    it("should extract valid entities from a successful response", async () => {
      const entities = [
        { label: "COMPRADOR", value: "Juan Pérez", group: "PARTES", confidence: "ALTA" },
        { label: "PRECIO_TOTAL", value: "$2,000,000 MXN", group: "INMUEBLE", confidence: "MEDIA" },
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

      const result = await service.extractEntities("Contrato de compra...");

      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].label).toBe("COMPRADOR");
      expect(result.entities[1].label).toBe("PRECIO_TOTAL");
      expect(result.rawResponse).toBe(JSON.stringify({ entities }));
    });

    it("should include sourceSpan when provided by AI", async () => {
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

      const result = await service.extractEntities("some text");

      expect(result.entities[0].sourceSpan).toEqual({ start: 34, end: 43 });
    });

    it("should filter invalid entities and keep valid ones on Zod partial failure", async () => {
      const entities = [
        { label: "COMPRADOR", value: "Juan Pérez", group: "PARTES", confidence: "ALTA" },
        { label: "BAD_GROUP", value: "something", group: "INVALID_GROUP", confidence: "ALTA" },
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

      const result = await service.extractEntities("some text");

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].label).toBe("COMPRADOR");
    });

    it("should throw OpenRouterError when all entities fail Zod validation", async () => {
      const entities = [
        { label: "BAD", value: "x", group: "INVALID", confidence: "NOPE" },
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

      try {
        await service.extractEntities("text");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(OpenRouterError);
        expect((err as OpenRouterError).code).toBe("INVALID_RESPONSE");
        expect((err as OpenRouterError).message).toContain("Zod validation failed");
      }
    });

    it("should throw OpenRouterError with AUTH_ERROR on 401 status", async () => {
      const error = new Error("Unauthorized");
      Object.defineProperty(error, "status", { value: 401 });

      mockCreate.mockRejectedValue(error);

      try {
        await service.extractEntities("text");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(OpenRouterError);
        expect((err as OpenRouterError).code).toBe("AUTH_ERROR");
      }
    });

    it("should throw OpenRouterError with MODEL_NOT_FOUND on 404 status", async () => {
      const error = new Error("Not found");
      Object.defineProperty(error, "status", { value: 404 });

      mockCreate.mockRejectedValue(error);

      try {
        await service.extractEntities("text");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(OpenRouterError);
        expect((err as OpenRouterError).code).toBe("MODEL_NOT_FOUND");
      }
    });

    it("should throw OpenRouterError with RATE_LIMIT on 429 status", async () => {
      const error = new Error("Too many requests");
      Object.defineProperty(error, "status", { value: 429 });

      mockCreate.mockRejectedValue(error);

      try {
        await service.extractEntities("text");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(OpenRouterError);
        expect((err as OpenRouterError).code).toBe("RATE_LIMIT");
      }
    });

    it("should throw OpenRouterError with NETWORK_ERROR on generic error", async () => {
      mockCreate.mockRejectedValue(new Error("Connection refused"));

      try {
        await service.extractEntities("text");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(OpenRouterError);
        expect((err as OpenRouterError).code).toBe("NETWORK_ERROR");
      }
    });

    it("should throw INVALID_RESPONSE on malformed JSON (truncated)", async () => {
      // Simulate truncated JSON response from AI
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '{"entities": [{"label": "COMPRADOR", "value": "Juan', // truncated
            },
          },
        ],
      });

      try {
        await service.extractEntities("text");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(OpenRouterError);
        expect((err as OpenRouterError).code).toBe("INVALID_RESPONSE");
        expect((err as OpenRouterError).message).toContain("Invalid JSON response");
        expect((err as OpenRouterError).message).not.toContain("unreachable"); // not misclassified
      }
    });

    it("should parse JSON wrapped in markdown fences", async () => {
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

      const result = await service.extractEntities("text");

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].label).toBe("COMPRADOR");
    });

    it("should throw INVALID_RESPONSE when given plain non-JSON text", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "Lo siento, no puedo procesar este documento.",
            },
          },
        ],
      });

      try {
        await service.extractEntities("text");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(OpenRouterError);
        expect((err as OpenRouterError).code).toBe("INVALID_RESPONSE");
      }
    });

    it("should throw INVALID_RESPONSE for SyntaxError from any code path", async () => {
      // Simulate a scenario where a SyntaxError reaches the catch block
      // (B2 safety net: the guard after instanceof OpenRouterError check)
      const syntaxErr = new SyntaxError("Unexpected token");
      // Remove .status so it falls through to the SyntaxError guard
      mockCreate.mockRejectedValue(syntaxErr);

      try {
        await service.extractEntities("text");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(OpenRouterError);
        expect((err as OpenRouterError).code).toBe("INVALID_RESPONSE");
        expect((err as OpenRouterError).code).not.toBe("NETWORK_ERROR");
      }
    });
  });

  describe("classifySpan", () => {
    it("should classify a text span and return label, group, value", async () => {
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

      expect(result).toEqual({
        label: "ARRENDATARIO",
        group: "PARTES",
        value: "Juan Pérez",
      });
    });

    it("should use temperature 0 and max_tokens 150", async () => {
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
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: '```json\n{"label": "PRECIO", "group": "INMUEBLE", "value": "$2,000,000"}\n```',
            },
          },
        ],
      });

      const result = await service.classifySpan("$2,000,000", "por un precio de $2,000,000");

      expect(result).toEqual({
        label: "PRECIO",
        group: "INMUEBLE",
        value: "$2,000,000",
      });
    });

    it("should throw OpenRouterError with INVALID_RESPONSE on malformed JSON", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: "I cannot classify this text.",
            },
          },
        ],
      });

      try {
        await service.classifySpan("some text", "context");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(OpenRouterError);
        expect((err as OpenRouterError).code).toBe("INVALID_RESPONSE");
      }
    });

    it("should throw OpenRouterError with INVALID_RESPONSE on invalid group", async () => {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                label: "FIELD",
                group: "INVALID_GROUP",
                value: "some value",
              }),
            },
          },
        ],
      });

      try {
        await service.classifySpan("some text", "context");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(OpenRouterError);
        expect((err as OpenRouterError).code).toBe("INVALID_RESPONSE");
      }
    });

    it("should throw NETWORK_ERROR on connection failure", async () => {
      mockCreate.mockRejectedValue(new Error("Connection refused"));

      try {
        await service.classifySpan("text", "context");
        expect.unreachable("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(OpenRouterError);
        expect((err as OpenRouterError).code).toBe("NETWORK_ERROR");
      }
    });
  });
});