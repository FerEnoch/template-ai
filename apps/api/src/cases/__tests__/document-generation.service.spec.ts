import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock AI_CONFIG before any imports that transitively load config/ai.ts
vi.mock("../../config/ai.js", () => ({
  AI_CONFIG: {
    model: "test-model",
    modelFallback: "test-fallback",
    apiKey: "test-key",
    maxTokens: 8192,
    temperature: 0.1,
  },
  CACHE_CONFIG: {
    enabled: false,
    responseCacheTtl: 604800,
    textCacheTtl: 604800,
    maxEntryBytes: 1048576,
  },
  AI_GENERATION_CONFIG: {
    maxTokens: 16384,
    temperature: 0.3,
  },
}));

import { DocumentGenerationService } from "../../ai/document-generation.service";
import { OpenRouterService, OpenRouterError } from "../../ai/open-router.service";
import type { CachePort } from "../../infrastructure/redis/index.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGenerateDocument = vi.fn();

function createMockOpenRouterService(): OpenRouterService {
  return {
    generateDocument: mockGenerateDocument,
  } as unknown as OpenRouterService;
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const sampleEntities = [
  { id: "ent-1", label: "COMPRADOR", value: "", group: "PARTES", confidence: "ALTA" },
  { id: "ent-2", label: "PRECIO_TOTAL", value: "", group: "INMUEBLE", confidence: "ALTA" },
];

const sampleFormData: Record<string, string> = {
  "ent-1": "Juan Pérez",
  "ent-2": "$2,000,000 MXN",
};

const sampleBaseText = "Contrato de compraventa que celebran las partes...";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DocumentGenerationService", () => {
  let service: DocumentGenerationService;
  let mockOpenRouter: OpenRouterService;

  beforeEach(() => {
    vi.resetAllMocks();
    mockOpenRouter = createMockOpenRouterService();
    service = new DocumentGenerationService(mockOpenRouter);
  });

  describe("generate", () => {
    it("should generate a document from entities, form data, and base text", async () => {
      const generatedText = "Contrato de compraventa entre Juan Pérez y el vendedor por $2,000,000 MXN.";
      mockGenerateDocument.mockResolvedValue({ generatedText });

      const result = await service.generate({
        entities: sampleEntities,
        formData: sampleFormData,
        baseText: sampleBaseText,
      });

      expect(result.success).toBe(true);
      expect(result.generatedText).toBe(generatedText);
      expect(mockGenerateDocument).toHaveBeenCalledOnce();
    });

    it("should succeed with NULL base text (graceful degradation)", async () => {
      const generatedText = "Documento generado solo con entidades y formulario.";
      mockGenerateDocument.mockResolvedValue({ generatedText });

      const result = await service.generate({
        entities: sampleEntities,
        formData: sampleFormData,
        baseText: null,
      });

      expect(result.success).toBe(true);
      expect(result.generatedText).toBe(generatedText);
      expect(result.baseTextMissing).toBe(true);
    });

    it("should retry on RATE_LIMIT up to 3 attempts", async () => {
      vi.useFakeTimers();

      const generatedText = "Generated after retries.";
      mockGenerateDocument
        .mockRejectedValueOnce(new OpenRouterError("rate limited", "RATE_LIMIT"))
        .mockRejectedValueOnce(new OpenRouterError("rate limited again", "RATE_LIMIT"))
        .mockResolvedValue({ generatedText });

      const generatePromise = service.generate({
        entities: sampleEntities,
        formData: sampleFormData,
        baseText: sampleBaseText,
      });

      await vi.runAllTimersAsync();
      const result = await generatePromise;

      expect(result.success).toBe(true);
      expect(result.generatedText).toBe(generatedText);
      expect(mockGenerateDocument).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it("should retry on NETWORK_ERROR", async () => {
      vi.useFakeTimers();

      const generatedText = "Generated after network retry.";
      mockGenerateDocument
        .mockRejectedValueOnce(new OpenRouterError("unreachable", "NETWORK_ERROR"))
        .mockResolvedValue({ generatedText });

      const generatePromise = service.generate({
        entities: sampleEntities,
        formData: sampleFormData,
        baseText: sampleBaseText,
      });

      await vi.runAllTimersAsync();
      const result = await generatePromise;

      expect(result.success).toBe(true);
      expect(mockGenerateDocument).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });

    it("should return failure after exhausting all retries", async () => {
      vi.useFakeTimers();

      mockGenerateDocument
        .mockRejectedValue(new OpenRouterError("e1", "INVALID_RESPONSE"))
        .mockRejectedValue(new OpenRouterError("e2", "INVALID_RESPONSE"))
        .mockRejectedValue(new OpenRouterError("e3", "INVALID_RESPONSE"));

      const generatePromise = service.generate({
        entities: sampleEntities,
        formData: sampleFormData,
        baseText: sampleBaseText,
      });

      await vi.runAllTimersAsync();
      const result = await generatePromise;

      expect(result.success).toBe(false);
      expect(result.error).toContain("e3");
      expect(mockGenerateDocument).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });

    it("should return 502-equivalent error on persistent NETWORK_ERROR", async () => {
      vi.useFakeTimers();

      mockGenerateDocument
        .mockRejectedValue(new OpenRouterError("net1", "NETWORK_ERROR"))
        .mockRejectedValue(new OpenRouterError("net2", "NETWORK_ERROR"))
        .mockRejectedValue(new OpenRouterError("net3", "NETWORK_ERROR"));

      const generatePromise = service.generate({
        entities: sampleEntities,
        formData: sampleFormData,
        baseText: sampleBaseText,
      });

      await vi.runAllTimersAsync();
      const result = await generatePromise;

      expect(result.success).toBe(false);
      expect(result.errorType).toBe("NETWORK_ERROR");

      vi.useRealTimers();
    });

    it("should NOT retry on AUTH_ERROR (non-retryable)", async () => {
      mockGenerateDocument.mockRejectedValue(
        new OpenRouterError("bad key", "AUTH_ERROR"),
      );

      const result = await service.generate({
        entities: sampleEntities,
        formData: sampleFormData,
        baseText: sampleBaseText,
      });

      expect(result.success).toBe(false);
      expect(mockGenerateDocument).toHaveBeenCalledTimes(1);
    });
  });
});
