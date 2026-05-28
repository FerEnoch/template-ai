import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { AnalysisController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";
import type { AnalysisResult } from "./analysis.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAnalysisResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    documentId: "550e8400-e29b-41d4-a716-446655440000",
    status: "processing",
    progress: 25,
    startedAt: "2026-05-27T10:30:05.000Z",
    completedAt: null,
    entities: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AnalysisController", () => {
  let service: AnalysisService;
  let controller: AnalysisController;

  beforeEach(() => {
    service = {
      getFullResult: vi.fn(),
      getStatus: vi.fn(),
    } as unknown as AnalysisService;
    controller = new AnalysisController(service);
  });

  describe("GET /:id — full result", () => {
    it("should return full analysis result with entities, status, and progress", async () => {
      const result = makeAnalysisResult({
        documentId: "doc-uuid-1",
        status: "completed",
        progress: 100,
        startedAt: "2026-05-27T10:30:05.000Z",
        completedAt: "2026-05-27T10:35:22.000Z",
        entities: [
          {
            id: "entity-1",
            label: "COMPRADOR",
            value: "María González López",
            group: "PARTES",
            confidence: "ALTA",
            sourceSpan: { start: 142, end: 163 },
            reviewed: false,
            excluded: false,
          },
        ],
      });
      vi.spyOn(service, "getFullResult").mockResolvedValue(result);

      const response = await controller.getFullResult("doc-uuid-1");

      expect(response).toEqual({
        documentId: "doc-uuid-1",
        status: "completed",
        progress: 100,
        startedAt: "2026-05-27T10:30:05.000Z",
        completedAt: "2026-05-27T10:35:22.000Z",
        entities: [
          {
            id: "entity-1",
            label: "COMPRADOR",
            value: "María González López",
            group: "PARTES",
            confidence: "ALTA",
            sourceSpan: { start: 142, end: 163 },
            reviewed: false,
            excluded: false,
          },
        ],
      });
      expect(service.getFullResult).toHaveBeenCalledWith("doc-uuid-1");
    });

    it("should throw NotFoundException when document has no analysis result", async () => {
      vi.spyOn(service, "getFullResult").mockRejectedValue(
        new NotFoundException("Analysis result not found"),
      );

      await expect(controller.getFullResult("nonexistent-uuid")).rejects.toThrow(
        NotFoundException,
      );
      await expect(controller.getFullResult("nonexistent-uuid")).rejects.toThrow(
        "Analysis result not found",
      );
    });

    it("should return empty entities array when analysis is still processing", async () => {
      const result = makeAnalysisResult({
        documentId: "doc-uuid-2",
        status: "processing",
        progress: 50,
        entities: [],
      });
      vi.spyOn(service, "getFullResult").mockResolvedValue(result);

      const response = await controller.getFullResult("doc-uuid-2");

      expect(response.status).toBe("processing");
      expect(response.progress).toBe(50);
      expect(response.entities).toEqual([]);
      expect(response.completedAt).toBeNull();
    });

    it("should return startedAt but no completedAt when status is processing", async () => {
      const result = makeAnalysisResult({
        documentId: "doc-uuid-3",
        status: "processing",
        progress: 75,
        startedAt: "2026-05-27T10:30:05.000Z",
        completedAt: null,
        entities: [],
      });
      vi.spyOn(service, "getFullResult").mockResolvedValue(result);

      const response = await controller.getFullResult("doc-uuid-3");

      expect(response.startedAt).toBe("2026-05-27T10:30:05.000Z");
      expect(response.completedAt).toBeNull();
    });

    it("should return completedAt as ISO string when status is completed", async () => {
      const result = makeAnalysisResult({
        documentId: "doc-uuid-4",
        status: "completed",
        progress: 100,
        startedAt: "2026-05-27T10:30:05.000Z",
        completedAt: "2026-05-27T10:35:22.000Z",
        entities: [],
      });
      vi.spyOn(service, "getFullResult").mockResolvedValue(result);

      const response = await controller.getFullResult("doc-uuid-4");

      expect(response.completedAt).toBe("2026-05-27T10:35:22.000Z");
    });
  });

  describe("GET /:id/status — lightweight", () => {
    it("should return only documentId, status, and progress", async () => {
      vi.spyOn(service, "getStatus").mockResolvedValue({
        documentId: "doc-uuid-1",
        status: "processing",
        progress: 50,
      });

      const response = await controller.getStatus("doc-uuid-1");

      expect(response).toEqual({
        documentId: "doc-uuid-1",
        status: "processing",
        progress: 50,
      });
      expect(service.getStatus).toHaveBeenCalledWith("doc-uuid-1");
    });

    it("should throw NotFoundException when document has no analysis result", async () => {
      vi.spyOn(service, "getStatus").mockRejectedValue(
        new NotFoundException("Analysis result not found"),
      );

      await expect(controller.getStatus("nonexistent-uuid")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should return completed status when analysis is done", async () => {
      vi.spyOn(service, "getStatus").mockResolvedValue({
        documentId: "doc-uuid-done",
        status: "completed",
        progress: 100,
      });

      const response = await controller.getStatus("doc-uuid-done");

      expect(response.status).toBe("completed");
      expect(response.progress).toBe(100);
    });
  });
});