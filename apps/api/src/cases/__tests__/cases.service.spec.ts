import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { CasesService } from "../cases.service";
import { DocumentGenerationService } from "../../ai/document-generation.service.js";
import { PostgresService, type TransactionContext } from "../../infrastructure/postgres/postgres.service";
import type { CaseRecord } from "../../infrastructure/postgres/repositories/cases.repository";

const mockGenerationService = {
  generate: vi.fn().mockResolvedValue({
    success: true,
    generatedText: "Generated legal document text",
  }),
} as unknown as DocumentGenerationService;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCaseRecord(overrides: Partial<CaseRecord> = {}): CaseRecord {
  return {
    id: "case-uuid-1",
    userId: 0,
    templateId: "tmpl-uuid-1",
    status: "borrador",
    formData: {},
    generatedText: null,
    createdAt: new Date("2025-06-01T10:00:00Z"),
    updatedAt: new Date("2025-06-01T10:00:00Z"),
    ...overrides,
  };
}

function createMockPostgresService(setup: {
  caseRecords?: CaseRecord[];
  createdRecord?: CaseRecord;
  findByIdRecord?: CaseRecord | null;
  templateExists?: boolean;
  updateRecord?: CaseRecord | null;
}): {
  mockPostgres: PostgresService;
  mockClient: { query: ReturnType<typeof vi.fn> };
} {
  const {
    caseRecords = [],
    createdRecord,
    findByIdRecord = null,
    templateExists = true,
    updateRecord = null,
  } = setup;

  const mockClient = { query: vi.fn() };

  mockClient.query.mockImplementation((sql: string, params?: unknown[]) => {
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return Promise.resolve({ rowCount: 0, rows: [] });
    }
    if (sql.includes("SET LOCAL")) {
      return Promise.resolve({ rowCount: 0, rows: [] });
    }

    // Check template exists (for create)
    if (sql.includes("SELECT") && sql.includes("FROM templates") && sql.includes("WHERE id =")) {
      if (!templateExists) {
        return Promise.resolve({ rowCount: 0, rows: [] });
      }
      return Promise.resolve({
        rowCount: 1,
        rows: [{ id: params?.[0] ?? "tmpl-uuid-1", user_id: 0 }],
      });
    }

    // INSERT INTO casos (create)
    if (sql.includes("INSERT INTO casos")) {
      const record = createdRecord ?? makeCaseRecord();
      return Promise.resolve({
        rowCount: 1,
        rows: [
          {
            id: record.id,
            user_id: record.userId,
            template_id: record.templateId,
            status: record.status,
            form_data: record.formData,
            generated_text: record.generatedText,
            created_at: record.createdAt,
            updated_at: record.updatedAt,
          },
        ],
      });
    }

    // SELECT casos by id (findById)
    if (
      sql.includes("SELECT") &&
      sql.includes("FROM casos") &&
      sql.includes("WHERE id =")
    ) {
      if (!findByIdRecord) {
        return Promise.resolve({ rowCount: 0, rows: [] });
      }
      return Promise.resolve({
        rowCount: 1,
        rows: [
          {
            id: findByIdRecord.id,
            user_id: findByIdRecord.userId,
            template_id: findByIdRecord.templateId,
            status: findByIdRecord.status,
            form_data: findByIdRecord.formData,
            generated_text: findByIdRecord.generatedText,
            created_at: findByIdRecord.createdAt,
            updated_at: findByIdRecord.updatedAt,
          },
        ],
      });
    }

    // SELECT casos by user_id (findByUserId)
    if (
      sql.includes("SELECT") &&
      sql.includes("FROM casos") &&
      sql.includes("WHERE user_id =")
    ) {
      return Promise.resolve({
        rowCount: caseRecords.length,
        rows: caseRecords.map((r) => ({
          id: r.id,
          user_id: r.userId,
          template_id: r.templateId,
          status: r.status,
          form_data: r.formData,
          generated_text: r.generatedText,
          created_at: r.createdAt,
          updated_at: r.updatedAt,
        })),
      });
    }

    // UPDATE casos (updateFormData / updateStatus)
    if (sql.includes("UPDATE casos")) {
      if (!updateRecord) {
        return Promise.resolve({ rowCount: 0, rows: [] });
      }
      return Promise.resolve({
        rowCount: 1,
        rows: [
          {
            id: updateRecord.id,
            user_id: updateRecord.userId,
            template_id: updateRecord.templateId,
            status: updateRecord.status,
            form_data: updateRecord.formData,
            generated_text: updateRecord.generatedText,
            created_at: updateRecord.createdAt,
            updated_at: updateRecord.updatedAt,
          },
        ],
      });
    }

    return Promise.resolve({ rowCount: 0, rows: [] });
  });

  const mockPostgres = {
    withOwnerTransaction: vi.fn(
      async (
        ownerId: number,
        cb: (ctx: TransactionContext) => Promise<unknown>,
      ) => {
        await mockClient.query("BEGIN");
        await mockClient.query(`SET LOCAL app.current_user_id = $1`, [
          ownerId,
        ]);
        const result = await cb({ client: mockClient as never, ownerId });
        await mockClient.query("COMMIT");
        return result;
      },
    ),
  } as unknown as PostgresService;

  return { mockPostgres, mockClient };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CasesService", () => {
  describe("create", () => {
    it("should create a case with status borrador and empty form_data", async () => {
      const created = makeCaseRecord({
        id: "new-case-uuid",
        templateId: "tmpl-uuid-1",
        status: "borrador",
        formData: {},
      });

      const { mockPostgres } = createMockPostgresService({
        createdRecord: created,
        templateExists: true,
      });
      const service = new CasesService(mockPostgres, mockGenerationService);

      const result = await service.create(0, { templateId: "tmpl-uuid-1" });

      expect(result.id).toBe("new-case-uuid");
      expect(result.status).toBe("borrador");
      expect(result.templateId).toBe("tmpl-uuid-1");
      expect(result.formData).toEqual({});
    });

    it("should throw NotFoundException when template does not exist", async () => {
      const { mockPostgres } = createMockPostgresService({
        templateExists: false,
      });
      const service = new CasesService(mockPostgres, mockGenerationService);

      await expect(
        service.create(0, { templateId: "non-existent-uuid" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findOne", () => {
    it("should return a case by id", async () => {
      const record = makeCaseRecord({
        id: "case-uuid-1",
        templateId: "tmpl-uuid-1",
        status: "borrador",
      });

      const { mockPostgres } = createMockPostgresService({
        findByIdRecord: record,
      });
      const service = new CasesService(mockPostgres, mockGenerationService);

      const result = await service.findOne(0, "case-uuid-1");

      expect(result.id).toBe("case-uuid-1");
      expect(result.templateId).toBe("tmpl-uuid-1");
    });

    it("should throw NotFoundException when case is not found", async () => {
      const { mockPostgres } = createMockPostgresService({
        findByIdRecord: null,
      });
      const service = new CasesService(mockPostgres, mockGenerationService);

      await expect(
        service.findOne(0, "non-existent"),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("list", () => {
    it("should return all cases for the user", async () => {
      const records = [
        makeCaseRecord({ id: "case-1", status: "borrador" }),
        makeCaseRecord({ id: "case-2", status: "generado" }),
      ];

      const { mockPostgres } = createMockPostgresService({
        caseRecords: records,
      });
      const service = new CasesService(mockPostgres, mockGenerationService);

      const result = await service.list(0);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("case-1");
      expect(result[1].id).toBe("case-2");
    });

    it("should filter cases by status when provided", async () => {
      const records = [
        makeCaseRecord({ id: "case-1", status: "borrador" }),
      ];

      const { mockPostgres } = createMockPostgresService({
        caseRecords: records,
      });
      const service = new CasesService(mockPostgres, mockGenerationService);

      const result = await service.list(0, "borrador");

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("borrador");
    });

    it("should return empty array when no cases exist", async () => {
      const { mockPostgres } = createMockPostgresService({
        caseRecords: [],
      });
      const service = new CasesService(mockPostgres, mockGenerationService);

      const result = await service.list(0);

      expect(result).toEqual([]);
    });
  });

  describe("updateFormData", () => {
    it("should update form data on a borrador case", async () => {
      const existing = makeCaseRecord({
        id: "case-uuid-1",
        status: "borrador",
        formData: {},
      });
      const updated = makeCaseRecord({
        id: "case-uuid-1",
        status: "borrador",
        formData: { ent_1: "Juan Pérez" },
      });

      const { mockPostgres } = createMockPostgresService({
        findByIdRecord: existing,
        updateRecord: updated,
      });
      const service = new CasesService(mockPostgres, mockGenerationService);

      const result = await service.updateFormData(0, "case-uuid-1", {
        formData: { ent_1: "Juan Pérez" },
      });

      expect(result.formData).toEqual({ ent_1: "Juan Pérez" });
    });

    it("should throw ConflictException when updating a generado case", async () => {
      const existing = makeCaseRecord({
        id: "case-uuid-1",
        status: "generado",
      });

      const { mockPostgres } = createMockPostgresService({
        findByIdRecord: existing,
      });
      const service = new CasesService(mockPostgres, mockGenerationService);

      await expect(
        service.updateFormData(0, "case-uuid-1", {
          formData: { ent_1: "value" },
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw ConflictException when updating an archivado case", async () => {
      const existing = makeCaseRecord({
        id: "case-uuid-1",
        status: "archivado",
      });

      const { mockPostgres } = createMockPostgresService({
        findByIdRecord: existing,
      });
      const service = new CasesService(mockPostgres, mockGenerationService);

      await expect(
        service.updateFormData(0, "case-uuid-1", {
          formData: { ent_1: "value" },
        }),
      ).rejects.toThrow(ConflictException);
    });

    it("should throw NotFoundException when case does not exist", async () => {
      const { mockPostgres } = createMockPostgresService({
        findByIdRecord: null,
      });
      const service = new CasesService(mockPostgres, mockGenerationService);

      await expect(
        service.updateFormData(0, "non-existent", {
          formData: { ent_1: "value" },
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("archive", () => {
    it("should archive a case by setting status to archivado", async () => {
      const existing = makeCaseRecord({
        id: "case-uuid-1",
        status: "exportado",
      });
      const archived = makeCaseRecord({
        id: "case-uuid-1",
        status: "archivado",
      });

      const { mockPostgres } = createMockPostgresService({
        findByIdRecord: existing,
        updateRecord: archived,
      });
      const service = new CasesService(mockPostgres, mockGenerationService);

      const result = await service.archive(0, "case-uuid-1");

      expect(result.status).toBe("archivado");
    });

    it("should throw NotFoundException when archiving a non-existent case", async () => {
      const { mockPostgres } = createMockPostgresService({
        findByIdRecord: null,
      });
      const service = new CasesService(mockPostgres, mockGenerationService);

      await expect(service.archive(0, "non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
