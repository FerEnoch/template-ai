import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "@nestjs/common";

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
import { VerificationService } from "../../ai/verification.service.js";
import type { CachePort } from "../../infrastructure/redis/index.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGenerateDocument = vi.fn();
const mockVerify = vi.fn();

function createMockOpenRouterService(): OpenRouterService {
  return {
    generateDocument: mockGenerateDocument,
  } as unknown as OpenRouterService;
}

function createMockVerificationService(): VerificationService {
  return {
    verify: mockVerify,
  } as unknown as VerificationService;
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
  let mockVerification: VerificationService;

  beforeEach(() => {
    vi.resetAllMocks();
    mockOpenRouter = createMockOpenRouterService();
    mockVerification = createMockVerificationService();
    mockVerify.mockResolvedValue({
      passed: true,
      completarCount: 0,
      warnings: [],
    });
    service = new DocumentGenerationService(mockOpenRouter, mockVerification);
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
      expect(mockGenerateDocument).toHaveBeenCalledWith(
        "generation",
        expect.objectContaining({
          entities: expect.stringContaining("COMPRADOR"),
          formData: expect.stringContaining("Juan Pérez"),
          baseText: sampleBaseText,
        }),
      );
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
      expect(mockGenerateDocument).toHaveBeenCalledWith(
        "generation-no-base",
        expect.objectContaining({
          entities: expect.any(String),
          formData: expect.any(String),
        }),
      );
      expect(mockGenerateDocument).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ baseText: expect.any(String) }),
      );
    });

    it("should delegate to OpenRouterService.generateDocument once (retry handled internally)", async () => {
      const generatedText = "Generated document.";
      mockGenerateDocument.mockResolvedValue({ generatedText });

      const result = await service.generate({
        entities: sampleEntities,
        formData: sampleFormData,
        baseText: sampleBaseText,
      });

      expect(result.success).toBe(true);
      expect(result.generatedText).toBe(generatedText);
      expect(mockGenerateDocument).toHaveBeenCalledTimes(1);
    });

    it("should propagate OpenRouterError without retrying", async () => {
      mockGenerateDocument.mockRejectedValue(
        new OpenRouterError("rate limited", "RATE_LIMIT"),
      );

      const result = await service.generate({
        entities: sampleEntities,
        formData: sampleFormData,
        baseText: sampleBaseText,
      });

      expect(result.success).toBe(false);
      expect(mockGenerateDocument).toHaveBeenCalledTimes(1);
    });

    it("should return 502-equivalent error on persistent NETWORK_ERROR", async () => {
      vi.useFakeTimers();

      mockGenerateDocument
        .mockRejectedValueOnce(new OpenRouterError("net1", "NETWORK_ERROR"))
        .mockRejectedValueOnce(new OpenRouterError("net2", "NETWORK_ERROR"))
        .mockRejectedValueOnce(new OpenRouterError("net3", "NETWORK_ERROR"));

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

    it("should include verification data in a successful result", async () => {
      const generatedText = "Contrato de compraventa entre Juan Pérez.";
      const verification = {
        passed: true,
        completarCount: 0,
        warnings: [],
      };
      mockGenerateDocument.mockResolvedValue({ generatedText });
      mockVerify.mockResolvedValue(verification);

      const result = await service.generate({
        entities: sampleEntities,
        formData: sampleFormData,
        baseText: sampleBaseText,
      });

      expect(result.success).toBe(true);
      expect(result.verification).toEqual(verification);
      expect(mockVerify).toHaveBeenCalledTimes(1);
      expect(mockVerify).toHaveBeenCalledWith(generatedText);
    });

    it("should NOT block generation when verification finds [COMPLETAR]", async () => {
      const generatedText = "El Sr. [COMPLETAR] domiciliado en.";
      const verification = {
        passed: false,
        completarCount: 1,
        warnings: ["Falta nombre del arrendador"],
      };
      mockGenerateDocument.mockResolvedValue({ generatedText });
      mockVerify.mockResolvedValue(verification);

      const result = await service.generate({
        entities: sampleEntities,
        formData: sampleFormData,
        baseText: sampleBaseText,
      });

      expect(result.success).toBe(true);
      expect(result.verification).toEqual(verification);
    });

    it("should NOT block generation when verification is degraded", async () => {
      const generatedText = "Documento.";
      const verification = {
        passed: true,
        completarCount: 0,
        warnings: ["Verification model failed: timeout"],
        degraded: true,
      };
      mockGenerateDocument.mockResolvedValue({ generatedText });
      mockVerify.mockResolvedValue(verification);

      const result = await service.generate({
        entities: sampleEntities,
        formData: sampleFormData,
        baseText: sampleBaseText,
      });

      expect(result.success).toBe(true);
      expect(result.verification).toEqual(verification);
    });
  });

  describe("error logging", () => {
    it("logs the error after generateDocument fails", async () => {
      const loggerErrorSpy = vi
        .spyOn(Logger.prototype, "error")
        .mockImplementation(() => {});

      mockGenerateDocument.mockRejectedValue(
        new OpenRouterError("e1", "INVALID_RESPONSE"),
      );

      const result = await service.generate({
        entities: sampleEntities,
        formData: sampleFormData,
        baseText: sampleBaseText,
      });

      expect(result.success).toBe(false);
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        "Document generation failed",
        expect.stringContaining("e1"),
      );

      loggerErrorSpy.mockRestore();
    });
  });
});
