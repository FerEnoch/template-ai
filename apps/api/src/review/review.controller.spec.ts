import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { ReviewController } from "./review.controller";
import { ReviewService } from "./review.service";
import type { ReviewEntity } from "./review.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReviewEntity(overrides: Partial<ReviewEntity> = {}): ReviewEntity {
  return {
    id: "entity-uuid-1",
    documentId: "doc-uuid-1",
    label: "COMPRADOR",
    value: "María González López",
    group: "PARTES",
    confidence: "ALTA",
    sourceSpan: { start: 142, end: 163 },
    reviewed: false,
    excluded: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReviewController", () => {
  let service: ReviewService;
  let controller: ReviewController;

  beforeEach(() => {
    service = {
      updateEntity: vi.fn(),
    } as unknown as ReviewService;
    controller = new ReviewController(service);
  });

  describe("POST /:documentId/entities/:entityId", () => {
    it("should update entity fields (reviewed, value, excluded) and return updated entity", async () => {
      const updatedEntity = makeReviewEntity({
        id: "entity-uuid-1",
        documentId: "doc-uuid-1",
        reviewed: true,
        value: "Juan Pérez",
        excluded: false,
      });
      vi.spyOn(service, "updateEntity").mockResolvedValue(updatedEntity);

      const result = await controller.updateEntity("doc-uuid-1", "entity-uuid-1", {
        reviewed: true,
        value: "Juan Pérez",
      });

      expect(result).toEqual({
        id: "entity-uuid-1",
        documentId: "doc-uuid-1",
        label: "COMPRADOR",
        value: "Juan Pérez",
        group: "PARTES",
        confidence: "ALTA",
        sourceSpan: { start: 142, end: 163 },
        reviewed: true,
        excluded: false,
      });
      expect(service.updateEntity).toHaveBeenCalledWith("doc-uuid-1", "entity-uuid-1", {
        reviewed: true,
        value: "Juan Pérez",
      });
    });

    it("should throw NotFoundException for non-existent entity", async () => {
      vi.spyOn(service, "updateEntity").mockRejectedValue(
        new NotFoundException("Entity not found"),
      );

      await expect(
        controller.updateEntity("doc-uuid-1", "nonexistent-uuid", { reviewed: true }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        controller.updateEntity("doc-uuid-1", "nonexistent-uuid", { reviewed: true }),
      ).rejects.toThrow("Entity not found");
    });

    it("should update only excluded field when just excluded is sent", async () => {
      const updatedEntity = makeReviewEntity({
        id: "entity-uuid-1",
        excluded: true,
      });
      vi.spyOn(service, "updateEntity").mockResolvedValue(updatedEntity);

      const result = await controller.updateEntity("doc-uuid-1", "entity-uuid-1", {
        excluded: true,
      });

      expect(result.excluded).toBe(true);
      expect(service.updateEntity).toHaveBeenCalledWith("doc-uuid-1", "entity-uuid-1", {
        excluded: true,
      });
    });

    it("should pass documentId and entityId as separate params to service", async () => {
      const entity = makeReviewEntity({
        id: "entity-abc",
        documentId: "doc-xyz",
      });
      vi.spyOn(service, "updateEntity").mockResolvedValue(entity);

      await controller.updateEntity("doc-xyz", "entity-abc", { reviewed: true });

      expect(service.updateEntity).toHaveBeenCalledWith("doc-xyz", "entity-abc", {
        reviewed: true,
      });
    });
  });
});