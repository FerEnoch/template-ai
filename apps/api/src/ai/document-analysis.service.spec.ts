import { describe, expect, it, vi, beforeEach } from "vitest";
import { DocumentAnalysisService } from "./document-analysis.service.js";
import { OpenRouterService } from "./open-router.service.js";
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
  readFileSync: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DocumentAnalysisService", () => {
  let service: DocumentAnalysisService;
  let mockOpenRouter: OpenRouterService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOpenRouter = createMockOpenRouterService();
    service = new DocumentAnalysisService(mockOpenRouter);
  });

  describe("analyze", () => {
    it("should extract entities from a valid file", async () => {
      const entities: AiEntity[] = [
        { label: "COMPRADOR", value: "Juan Pérez", group: "PARTES", confidence: "ALTA" },
        { label: "PRECIO_TOTAL", value: "$1,500,000 MXN", group: "INMUEBLE", confidence: "MEDIA" },
      ];

      mockExtractEntities.mockResolvedValue({ entities, rawResponse: "[]" });

      const { readFileSync } = await import("node:fs");
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("Contrato de compra...");

      const result: AnalyzeResult = await service.analyze("/uploads/test.pdf");

      expect(result.success).toBe(true);
      expect(result.entities).toHaveLength(2);
      expect(result.entities![0].label).toBe("COMPRADOR");
      expect(result.entities![1].label).toBe("PRECIO_TOTAL");
      expect(mockExtractEntities).toHaveBeenCalledWith("Contrato de compra...");
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
      expect(result.error).toBe("File not found");
      expect(mockExtractEntities).not.toHaveBeenCalled();
    });

    it("should return error on AI extraction failure", async () => {
      const { readFileSync } = await import("node:fs");
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue("text content");

      mockExtractEntities.mockRejectedValue(new Error("Rate limit exceeded"));

      const result = await service.analyze("/uploads/test.pdf");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Rate limit exceeded");
    });
  });
});