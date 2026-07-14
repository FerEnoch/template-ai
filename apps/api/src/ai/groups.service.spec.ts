import { describe, expect, it, vi, beforeEach } from "vitest";
import { NotFoundException } from "@nestjs/common";
import { GroupsService, SEED_GROUPS } from "./groups.service.js";
import type { PostgresService } from "../infrastructure/postgres/postgres.service.js";
import type { TemplateRecord } from "../infrastructure/postgres/repositories/templates.repository.js";
import type { EntityRecord } from "../infrastructure/postgres/repositories/entities.repository.js";
import type { AnalysisResultRecord } from "../infrastructure/postgres/repositories/analysis-results.repository.js";
import type { PoolClient } from "pg";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTemplateRecord(overrides: Partial<TemplateRecord> = {}): TemplateRecord {
  return {
    id: "tmpl-1",
    userId: 0,
    name: "Contrato",
    description: "",
    documentId: "doc-1",
    category: "legal",
    status: "draft",
    entities: [],
    suggestedGroupsStatus: {},
    createdAt: new Date("2025-01-15T10:30:00Z"),
    deletedAt: null,
    ...overrides,
  };
}

function makeEntityRecord(overrides: Partial<EntityRecord> = {}): EntityRecord {
  return {
    id: "ent-1",
    analysisResultId: "ar-1",
    documentId: "doc-1",
    label: "Campo",
    value: "Valor",
    group: "JORNADA",
    confidence: "ALTA",
    sourceSpan: null,
    reviewed: true,
    reviewedAt: new Date("2025-01-15T10:30:00Z"),
    excluded: false,
    userCreated: false,
    ...overrides,
  };
}

interface QueryScenario {
  template?: TemplateRecord | null;
  analysisResults?: AnalysisResultRecord[];
  entitiesByAnalysisResult?: Record<string, EntityRecord[]>;
}

function createMockClient(scenario: QueryScenario = {}) {
  const query = vi.fn();

  query.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (
      sql === "BEGIN" ||
      sql === "COMMIT" ||
      sql === "ROLLBACK" ||
      sql.includes("SET LOCAL")
    ) {
      return { rowCount: 0, rows: [] };
    }

    if (sql.includes("SELECT") && sql.includes("FROM templates") && sql.includes("WHERE id =")) {
      const template = scenario.template ?? null;
      if (!template) {
        return { rowCount: 0, rows: [] };
      }
      return {
        rowCount: 1,
        rows: [
          {
            id: template.id,
            user_id: template.userId,
            name: template.name,
            description: template.description,
            document_id: template.documentId,
            category: template.category,
            status: template.status,
            entities: template.entities,
            suggested_groups_status: template.suggestedGroupsStatus,
            created_at: template.createdAt,
            deleted_at: template.deletedAt,
          },
        ],
      };
    }

    if (sql.includes("UPDATE templates") && sql.includes("suggested_groups_status")) {
      const template = scenario.template ?? makeTemplateRecord();
      return {
        rowCount: 1,
        rows: [
          {
            id: template.id,
            user_id: template.userId,
            name: template.name,
            description: template.description,
            document_id: template.documentId,
            category: template.category,
            status: template.status,
            entities: template.entities,
            suggested_groups_status: template.suggestedGroupsStatus,
            created_at: template.createdAt,
            deleted_at: template.deletedAt,
          },
        ],
      };
    }

    if (sql.includes("SELECT") && sql.includes("FROM analysis_results") && sql.includes("WHERE document_id =")) {
      return {
        rowCount: scenario.analysisResults?.length ?? 0,
        rows:
          scenario.analysisResults?.map((r) => ({
            id: r.id,
            document_id: r.documentId,
            status: r.status,
            progress: r.progress,
            started_at: r.startedAt,
            completed_at: r.completedAt,
            retry_count: r.retryCount,
            error_message: r.errorMessage,
            extracted_text: r.extractedText,
          })) ?? [],
      };
    }

    if (sql.includes("SELECT") && sql.includes("FROM entities") && sql.includes("WHERE analysis_result_id =")) {
      const analysisResultId = params?.[0] as string;
      const entities = scenario.entitiesByAnalysisResult?.[analysisResultId] ?? [];
      return {
        rowCount: entities.length,
        rows: entities.map((e) => ({
          id: e.id,
          analysis_result_id: e.analysisResultId,
          document_id: e.documentId,
          label: e.label,
          value: e.value,
          group: e.group,
          confidence: e.confidence,
          source_span: e.sourceSpan,
          reviewed: e.reviewed,
          reviewed_at: e.reviewedAt,
          excluded: e.excluded,
          user_created: e.userCreated,
        })),
      };
    }

    if (sql.includes("UPDATE entities")) {
      return { rowCount: 1, rows: [] };
    }

    return { rowCount: 0, rows: [] };
  });

  return { query };
}

function createMockPostgresService(scenario: QueryScenario = {}) {
  const { query } = createMockClient(scenario);
  const postgres = {
    withOwnerTransaction: vi.fn(async <T>(_ownerId: number, callback: (ctx: { client: PoolClient; ownerId: number }) => Promise<T>) => {
      return callback({ client: { query } as unknown as PoolClient, ownerId: _ownerId });
    }),
  } as unknown as PostgresService;
  return { postgres, query };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("GroupsService", () => {
  let service: GroupsService;

  beforeEach(() => {
    const { postgres } = createMockPostgresService();
    service = new GroupsService(postgres);
  });

  describe("resolve", () => {
    it("returns only seed groups when no templateId is provided", async () => {
      const result = await service.resolve();
      expect(result).toEqual(SEED_GROUPS);
    });

    it("returns seed groups plus approved dynamic groups", async () => {
      const { postgres } = createMockPostgresService({
        template: makeTemplateRecord({
          suggestedGroupsStatus: { JORNADA: "approved", HORARIO: "pending", DESCUENTO: "rejected" },
        }),
      });
      service = new GroupsService(postgres);

      const result = await service.resolve("tmpl-1");

      expect(result).toEqual([...SEED_GROUPS, "JORNADA"]);
    });

    it("ignores approved groups with invalid names", async () => {
      const { postgres } = createMockPostgresService({
        template: makeTemplateRecord({
          suggestedGroupsStatus: { JORNADA: "approved", trabajo: "approved", "A/B": "approved" },
        }),
      });
      service = new GroupsService(postgres);
      const warnSpy = vi.spyOn(service["logger"], "warn").mockImplementation(() => undefined);

      const result = await service.resolve("tmpl-1");

      expect(result).toEqual([...SEED_GROUPS, "JORNADA", "A/B"]);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("trabajo"));
      warnSpy.mockRestore();
    });

    it("falls back to seed groups when the template is not found", async () => {
      const { postgres } = createMockPostgresService({ template: null });
      service = new GroupsService(postgres);

      const result = await service.resolve("missing");

      expect(result).toEqual(SEED_GROUPS);
    });
  });

  describe("approve", () => {
    it("persists an approved dynamic group", async () => {
      const { postgres, query } = createMockPostgresService({
        template: makeTemplateRecord({ suggestedGroupsStatus: { JORNADA: "pending" } }),
      });
      service = new GroupsService(postgres);

      await service.approve("tmpl-1", "JORNADA");

      const updateCall = query.mock.calls.find((call) =>
        String(call[0]).includes("UPDATE templates") &&
        String(call[0]).includes("suggested_groups_status"),
      );
      expect(updateCall).toBeDefined();
      expect(updateCall?.[1]).toEqual([JSON.stringify({ JORNADA: "approved" }), "tmpl-1"]);
    });

    it("throws NotFoundException when the template does not exist", async () => {
      const { postgres } = createMockPostgresService({ template: null });
      service = new GroupsService(postgres);

      await expect(service.approve("missing", "JORNADA")).rejects.toThrow(NotFoundException);
    });

    it("ignores invalid group names and logs a warning", async () => {
      const { postgres, query } = createMockPostgresService({
        template: makeTemplateRecord(),
      });
      service = new GroupsService(postgres);
      const warnSpy = vi.spyOn(service["logger"], "warn").mockImplementation(() => undefined);

      await service.approve("tmpl-1", "trabajo");

      const updateCall = query.mock.calls.find((call) =>
        String(call[0]).includes("UPDATE templates"),
      );
      expect(updateCall).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("trabajo"));
      warnSpy.mockRestore();
    });
  });

  describe("reject", () => {
    it("persists a rejected status and reassigns entities to GENERAL", async () => {
      const { postgres, query } = createMockPostgresService({
        template: makeTemplateRecord({
          documentId: "doc-1",
          suggestedGroupsStatus: { JORNADA: "pending" },
        }),
        analysisResults: [
          {
            id: "ar-1",
            documentId: "doc-1",
            status: "completed",
            progress: 100,
            startedAt: new Date("2025-01-15T10:00:00Z"),
            completedAt: new Date("2025-01-15T10:01:00Z"),
            retryCount: 0,
            errorMessage: null,
            extractedText: null,
            suggestedGroups: [],
          },
        ],
        entitiesByAnalysisResult: {
          "ar-1": [
            makeEntityRecord({ id: "ent-1", analysisResultId: "ar-1", group: "JORNADA" }),
            makeEntityRecord({ id: "ent-2", analysisResultId: "ar-1", group: "PARTES" }),
          ],
        },
      });
      service = new GroupsService(postgres);

      await service.reject("tmpl-1", "JORNADA");

      const updateTemplateCall = query.mock.calls.find((call) =>
        String(call[0]).includes("UPDATE templates") &&
        String(call[0]).includes("suggested_groups_status"),
      );
      expect(updateTemplateCall).toBeDefined();
      expect(updateTemplateCall?.[1]).toEqual([JSON.stringify({ JORNADA: "rejected" }), "tmpl-1"]);

      const updateEntityCalls = query.mock.calls.filter((call) =>
        String(call[0]).includes("UPDATE entities"),
      );
      expect(updateEntityCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("throws NotFoundException when the template does not exist", async () => {
      const { postgres } = createMockPostgresService({ template: null });
      service = new GroupsService(postgres);

      await expect(service.reject("missing", "JORNADA")).rejects.toThrow(NotFoundException);
    });

    it("ignores invalid group names and logs a warning", async () => {
      const { postgres, query } = createMockPostgresService({
        template: makeTemplateRecord(),
      });
      service = new GroupsService(postgres);
      const warnSpy = vi.spyOn(service["logger"], "warn").mockImplementation(() => undefined);

      await service.reject("tmpl-1", "x");

      const updateTemplateCall = query.mock.calls.find((call) =>
        String(call[0]).includes("UPDATE templates"),
      );
      expect(updateTemplateCall).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("x"));
      warnSpy.mockRestore();
    });
  });
});
