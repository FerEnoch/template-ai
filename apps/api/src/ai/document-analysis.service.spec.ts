import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock AI_CONFIG before any imports that transitively load config/ai.ts
// (which calls getApiEnv() requiring PORT in the environment)
vi.mock("../config/ai.js", () => ({
  AI_CONFIG: {
    model: "test-model",
    modelFallback: "test-fallback",
    apiKey: "test-key",
    maxTokens: 8192,
    temperature: 0.1,
  },
}));

import { DocumentAnalysisService } from "./document-analysis.service.js";
import { OpenRouterService, OpenRouterError } from "./open-router.service.js";
import type { AnalyzeResult } from "./document-analysis.service.js";
import type { AiEntity } from "./open-router.service.js";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockExtractEntities = vi.fn();

// Create a mock OpenRouterService that delegates to our mock function
function createMockOpenRouterService(): OpenRouterService {
  return {
    extractEntities: mockExtractEntities,
  } as unknown as OpenRouterService;
}

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(() => Buffer.from("dummy pdf content")),
}));

vi.mock("pdf-parse", () => ({
  default: vi.fn(),
}));

vi.mock("mammoth", () => ({
  default: {
    extractRawText: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DocumentAnalysisService", () => {
  let service: DocumentAnalysisService;
  let mockOpenRouter: OpenRouterService;

  beforeEach(() => {
    vi.resetAllMocks();
    mockOpenRouter = createMockOpenRouterService();
    service = new DocumentAnalysisService(mockOpenRouter);
  });

  describe("analyze", () => {
    it("should extract entities from a valid PDF file", async () => {
      const entities: AiEntity[] = [
        { label: "COMPRADOR", value: "Juan Pérez", group: "PARTES", confidence: "ALTA" },
        { label: "PRECIO_TOTAL", value: "$1,500,000 MXN", group: "INMUEBLE", confidence: "MEDIA" },
      ];

      mockExtractEntities.mockResolvedValue({ entities, rawResponse: "[]" });

      const pdfParse = (await import("pdf-parse")).default;
      (pdfParse as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: "Contrato de compra...",
        numpages: 1,
      });

      const result: AnalyzeResult = await service.analyze("/uploads/test.pdf");

      expect(result.success).toBe(true);
      expect(result.extractedText).toBe("Contrato de compra...");
      expect(result.entities).toHaveLength(2);
      expect(result.entities![0].label).toBe("COMPRADOR");
      expect(result.entities![1].label).toBe("PRECIO_TOTAL");
      expect(mockExtractEntities).toHaveBeenCalledWith("Contrato de compra...");
    });

    it("should extract entities from a valid DOCX file", async () => {
      const entities: AiEntity[] = [
        { label: "COMPRADOR", value: "María López", group: "PARTES", confidence: "ALTA" },
      ];

      mockExtractEntities.mockResolvedValue({ entities, rawResponse: "[]" });

      const mammothModule = await import("mammoth");
      (mammothModule.default.extractRawText as ReturnType<typeof vi.fn>).mockResolvedValue({
        value: "Contrato de María López...",
      });

      const result: AnalyzeResult = await service.analyze("/uploads/test.docx");

      expect(result.success).toBe(true);
      expect(result.extractedText).toBe("Contrato de María López...");
      expect(result.entities).toHaveLength(1);
      expect(result.entities![0].label).toBe("COMPRADOR");
      expect(mockExtractEntities).toHaveBeenCalledWith("Contrato de María López...");
    });

    it("should return file not found error when filePath is null", async () => {
      const result = await service.analyze(null);

      expect(result.success).toBe(false);
      expect(result.error).toBe("File not found");
      expect(mockExtractEntities).not.toHaveBeenCalled();
    });

    it("should return file not found error when readFileSync throws", async () => {
      const { readFileSync } = await import("node:fs");
      (readFileSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("ENOENT: no such file");
      });

      const result = await service.analyze("/uploads/nonexistent.pdf");

      expect(result.success).toBe(false);
      expect(result.error).toContain("ENOENT");
      expect(mockExtractEntities).not.toHaveBeenCalled();
    });

    it("should return error for unsupported file types like JPEG", async () => {
      const result: AnalyzeResult = await service.analyze("/uploads/test.jpg");

      expect(result.success).toBe(false);
      expect(result.error).toContain("not supported");
      expect(mockExtractEntities).not.toHaveBeenCalled();
    });

    it("should return error when PDF has no extractable text", async () => {
      const pdfParse = (await import("pdf-parse")).default;
      (pdfParse as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: "",
        numpages: 1,
      });

      const result: AnalyzeResult = await service.analyze("/uploads/scanned.pdf");

      expect(result.success).toBe(false);
      expect(result.error).toContain("scanned");
      expect(mockExtractEntities).not.toHaveBeenCalled();
    });

    it("should return error on AI extraction failure", async () => {
      const pdfParse = (await import("pdf-parse")).default;
      (pdfParse as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: "Contrato de compra...",
        numpages: 1,
      });

      mockExtractEntities.mockRejectedValue(new Error("Rate limit exceeded"));

      const result = await service.analyze("/uploads/test.pdf");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Rate limit exceeded");
    });
  });

  describe("callAiWithRetry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should retry on RATE_LIMIT errors up to 3 attempts", async () => {
      mockExtractEntities
        .mockRejectedValueOnce(new OpenRouterError("rate limited", "RATE_LIMIT"))
        .mockRejectedValueOnce(new OpenRouterError("rate limited again", "RATE_LIMIT"))
        .mockResolvedValue({ entities: [], rawResponse: "[]" });

      // Trigger analyze which calls callAiWithRetry internally
      const pdfParse = (await import("pdf-parse")).default;
      (pdfParse as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: "test",
        numpages: 1,
      });

      const analyzePromise = service.analyze("/uploads/test.pdf");

      // Advance timers to skip backoff delays
      await vi.runAllTimersAsync();
      const result = await analyzePromise;

      expect(result.success).toBe(true);
      expect(mockExtractEntities).toHaveBeenCalledTimes(3);
    });

    it("should retry on NETWORK_ERROR", async () => {
      mockExtractEntities
        .mockRejectedValueOnce(new OpenRouterError("unreachable", "NETWORK_ERROR"))
        .mockResolvedValue({ entities: [], rawResponse: "[]" });

      const pdfParse = (await import("pdf-parse")).default;
      (pdfParse as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: "test",
        numpages: 1,
      });

      const analyzePromise = service.analyze("/uploads/test.pdf");
      await vi.runAllTimersAsync();
      const result = await analyzePromise;

      expect(result.success).toBe(true);
      expect(mockExtractEntities).toHaveBeenCalledTimes(2);
    });

    it("should retry on INVALID_RESPONSE", async () => {
      mockExtractEntities
        .mockRejectedValueOnce(new OpenRouterError("bad json", "INVALID_RESPONSE"))
        .mockResolvedValue({ entities: [], rawResponse: "[]" });

      const pdfParse = (await import("pdf-parse")).default;
      (pdfParse as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: "test",
        numpages: 1,
      });

      const analyzePromise = service.analyze("/uploads/test.pdf");
      await vi.runAllTimersAsync();
      const result = await analyzePromise;

      expect(result.success).toBe(true);
      expect(mockExtractEntities).toHaveBeenCalledTimes(2);
    });

    it("should NOT retry on CONFIG_ERROR (AUTH_ERROR)", async () => {
      mockExtractEntities.mockRejectedValue(
        new OpenRouterError("bad key", "AUTH_ERROR"),
      );

      const pdfParse = (await import("pdf-parse")).default;
      (pdfParse as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: "test",
        numpages: 1,
      });

      const result = await service.analyze("/uploads/test.pdf");

      expect(result.success).toBe(false);
      expect(mockExtractEntities).toHaveBeenCalledTimes(1);
    });

    it("should fail permanently after 3 attempts", async () => {
      mockExtractEntities
        .mockRejectedValue(new OpenRouterError("e1", "INVALID_RESPONSE"))
        .mockRejectedValue(new OpenRouterError("e2", "INVALID_RESPONSE"))
        .mockRejectedValue(new OpenRouterError("e3", "INVALID_RESPONSE"));

      const pdfParse = (await import("pdf-parse")).default;
      (pdfParse as ReturnType<typeof vi.fn>).mockResolvedValue({
        text: "test",
        numpages: 1,
      });

      const analyzePromise = service.analyze("/uploads/test.pdf");
      await vi.runAllTimersAsync();
      const result = await analyzePromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe("e3");
      expect(mockExtractEntities).toHaveBeenCalledTimes(3);
    });
  });
});
