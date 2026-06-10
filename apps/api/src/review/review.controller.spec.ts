import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common";
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
    userCreated: false,
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
      classifySpan: vi.fn(),
      createEntity: vi.fn(),
      countManualEntities: vi.fn(),
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
        userCreated: false,
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

  describe("POST /:documentId/entities/classify-span", () => {
    it("should classify a span and return the created entity", async () => {
      const entity = makeReviewEntity({
        id: "new-entity-1",
        label: "ARRENDATARIO",
        value: "Juan Pérez",
        userCreated: true,
      });
      vi.spyOn(service, "classifySpan").mockResolvedValue(entity);

      const result = await controller.classifySpan("doc-uuid-1", {
        text: "Juan Pérez",
        sourceSpan: { start: 34, end: 44 },
        context: "...entre Juan Pérez y María López...",
      });

      expect(result.entity.label).toBe("ARRENDATARIO");
      expect(result.entity.userCreated).toBe(true);
    });

    it("should throw BadRequestException on invalid request body", async () => {
      await expect(
        controller.classifySpan("doc-uuid-1", {
          text: "",
          sourceSpan: { start: 0, end: 5 },
          context: "context",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException on missing fields", async () => {
      await expect(
        controller.classifySpan("doc-uuid-1", {
          text: "hello",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should propagate ForbiddenException from service", async () => {
      vi.spyOn(service, "classifySpan").mockRejectedValue(
        new ForbiddenException("MANUAL_ENTITY_LIMIT_REACHED"),
      );

      await expect(
        controller.classifySpan("doc-uuid-1", {
          text: "Juan Pérez",
          sourceSpan: { start: 0, end: 10 },
          context: "context",
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("POST /:documentId/entities", () => {
    it("should create a manual entity", async () => {
      const entity = makeReviewEntity({
        id: "new-entity-1",
        label: "CUSTOM_FIELD",
        value: "custom value",
        userCreated: true,
      });
      vi.spyOn(service, "createEntity").mockResolvedValue(entity);

      const result = await controller.createEntity("doc-uuid-1", {
        label: "CUSTOM_FIELD",
        value: "custom value",
        group: "ANEXOS",
      });

      expect(result.entity.userCreated).toBe(true);
    });

    it("should throw BadRequestException when required fields are missing", async () => {
      await expect(
        controller.createEntity("doc-uuid-1", {
          label: "",
          value: "value",
          group: "PARTES",
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("GET /:documentId/entities/manual-count", () => {
    it("should return manual entity count with limit info", async () => {
      vi.spyOn(service, "countManualEntities").mockResolvedValue({
        count: 3,
        limit: 5,
        canAddMore: true,
      });

      const result = await controller.getManualEntityCount("doc-uuid-1");

      expect(result).toEqual({
        count: 3,
        limit: 5,
        canAddMore: true,
      });
    });

    it("should return canAddMore: false when at limit", async () => {
      vi.spyOn(service, "countManualEntities").mockResolvedValue({
        count: 5,
        limit: 5,
        canAddMore: false,
      });

      const result = await controller.getManualEntityCount("doc-uuid-1");

      expect(result.canAddMore).toBe(false);
    });
  });
});