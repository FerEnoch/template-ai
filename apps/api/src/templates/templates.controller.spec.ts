import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { TemplatesController } from "./templates.controller";
import { TemplatesService } from "./templates.service";
import type { TemplateResponse } from "./templates.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTemplateResponse(overrides: Partial<TemplateResponse> = {}): TemplateResponse {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Contrato de Arrendamiento",
    description: "Standard lease agreement template",
    documentId: "660e8400-e29b-41d4-a716-446655440001",
    entities: [],
    category: "legal",
    status: "draft",
    createdAt: "2025-01-15T10:30:00.000Z",
    ...overrides,
  };
}

const VALID_UUID = "660e8400-e29b-41d4-a716-446655440001";
const ENTITY_UUID = "770e8400-e29b-41d4-a716-446655440002";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("TemplatesController", () => {
  let service: TemplatesService;
  let controller: TemplatesController;

  beforeEach(() => {
    service = {
      list: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
    } as unknown as TemplatesService;
    controller = new TemplatesController(service);
  });

  describe("GET /", () => {
    it("should return an array of templates for the user", async () => {
      const templates = [
        makeTemplateResponse({ id: "tmpl-1", name: "Template A" }),
        makeTemplateResponse({ id: "tmpl-2", name: "Template B" }),
      ];
      vi.spyOn(service, "list").mockResolvedValue(templates);

      const result = await controller.findAll();

      expect(result).toEqual(templates);
      expect(service.list).toHaveBeenCalledWith(0, false);
    });

    it("should return an empty array when no templates exist", async () => {
      vi.spyOn(service, "list").mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
      expect(service.list).toHaveBeenCalledWith(0, false);
    });
  });

  describe("GET /:id", () => {
    it("should return a single template by id", async () => {
      const template = makeTemplateResponse({ id: "tmpl-1", name: "Template A" });
      vi.spyOn(service, "findOne").mockResolvedValue(template);

      const result = await controller.findOne("tmpl-1");

      expect(result).toEqual(template);
      expect(service.findOne).toHaveBeenCalledWith(0, "tmpl-1");
    });

    it("should throw NotFoundException when template is not found", async () => {
      vi.spyOn(service, "findOne").mockRejectedValue(
        new NotFoundException('Template with id "nonexistent" not found'),
      );

      await expect(controller.findOne("nonexistent")).rejects.toThrow(NotFoundException);
      await expect(controller.findOne("nonexistent")).rejects.toThrow('Template with id "nonexistent" not found');
    });
  });

  describe("POST /", () => {
    it("should create a template and return it with id and createdAt", async () => {
      const created = makeTemplateResponse({
        id: "770e8400-e29b-41d4-a716-446655440002",
        createdAt: "2025-02-01T12:00:00.000Z",
      });
      vi.spyOn(service, "create").mockResolvedValue(created);

      const body = {
        name: "Contrato de Arrendamiento",
        description: "Standard lease agreement template",
        documentId: VALID_UUID,
        entities: [
          { id: ENTITY_UUID, label: "COMPRADOR", value: "Juan Pérez", group: "PARTES" as const, confidence: "ALTA" as const, reviewed: false, excluded: false, userCreated: false },
        ],
        category: "legal",
        status: "draft" as const,
      };

      const result = await controller.create(body);

      expect(result).toEqual(created);
      expect(result.id).toBe("770e8400-e29b-41d4-a716-446655440002");
      expect(result.createdAt).toBe("2025-02-01T12:00:00.000Z");
      expect(service.create).toHaveBeenCalledWith(body);
    });

    it("should throw BadRequestException when name is too short (less than 3 chars)", async () => {
      const body = {
        name: "ab",
        description: "Short name test",
        documentId: VALID_UUID,
        entities: [],
        category: "legal",
        status: "draft" as const,
      };

      await expect(controller.create(body)).rejects.toThrow(BadRequestException);
      await expect(controller.create(body)).rejects.toThrow("String must contain at least 3 character(s)");
    });

    it("should throw BadRequestException when documentId is missing", async () => {
      const body = {
        name: "Valid Name",
        description: "Missing doc test",
        entities: [],
        category: "legal",
        status: "draft" as const,
      };

      await expect(controller.create(body)).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when documentId is not a valid UUID", async () => {
      const body = {
        name: "Valid Name",
        description: "Invalid doc test",
        documentId: "not-a-uuid",
        entities: [],
        category: "legal",
        status: "draft" as const,
      };

      await expect(controller.create(body)).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when name exceeds max length (200 chars)", async () => {
      const body = {
        name: "a".repeat(201),
        description: "Long name test",
        documentId: VALID_UUID,
        entities: [],
        category: "legal",
        status: "draft" as const,
      };

      await expect(controller.create(body)).rejects.toThrow(BadRequestException);
    });

    it("should propagate ConflictException when service detects duplicate name", async () => {
      vi.spyOn(service, "create").mockRejectedValue(
        new ConflictException('Ya existe una plantilla llamada "Duplicate Template". Elegí otro nombre.'),
      );

      const body = {
        name: "Duplicate Template",
        description: "Should conflict",
        documentId: VALID_UUID,
        entities: [],
        category: "legal",
        status: "draft" as const,
      };

      await expect(controller.create(body)).rejects.toThrow(ConflictException);
      await expect(controller.create(body)).rejects.toThrow(
        'Ya existe una plantilla llamada "Duplicate Template". Elegí otro nombre.',
      );
    });

  });
});