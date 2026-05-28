import { Injectable, NotFoundException } from "@nestjs/common";
import { PostgresService } from "../infrastructure/postgres/postgres.service";
import { AnalysisResultsRepository } from "../infrastructure/postgres/repositories/analysis-results.repository";
import { EntitiesRepository } from "../infrastructure/postgres/repositories/entities.repository";

// ---------------------------------------------------------------------------
// Sample entities — hardcoded POC data matching MSW fixtures
// ---------------------------------------------------------------------------

export const SAMPLE_ENTITIES = [
  { label: "COMPRADOR", value: "María González López", group: "PARTES", confidence: "ALTA" as const, sourceSpan: { start: 142, end: 163 } },
  { label: "VENDEDOR", value: "Carlos Rodríguez Pérez", group: "PARTES", confidence: "ALTA" as const, sourceSpan: { start: 165, end: 186 } },
  { label: "INMUEBLE", value: "Departamento en Av. Reforma 1234, Piso 8, Col. Juárez, CDMX", group: "INMUEBLE", confidence: "ALTA" as const, sourceSpan: { start: 220, end: 285 } },
  { label: "PRECIO_TOTAL", value: "$3,450,000.00 MXN", group: "INMUEBLE", confidence: "MEDIA" as const, sourceSpan: { start: 310, end: 325 } },
  { label: "FECHA_FIRMA", value: "15 de junio de 2026", group: "FECHAS", confidence: "ALTA" as const, sourceSpan: { start: 400, end: 420 } },
  { label: "ESCRITURA_NUMERO", value: "4,218", group: "ANEXOS", confidence: "BAJA" as const, sourceSpan: { start: 445, end: 450 } },
  { label: "NOTARIO", value: "Lic. Patricia Hernández Vega", group: "ANEXOS", confidence: "ALTA" as const, sourceSpan: { start: 470, end: 498 } },
  { label: "METODO_PAGO", value: "Transferencia bancaria por $1,725,000 y cheque de caja por $1,725,000", group: "INMUEBLE", confidence: "MEDIA" as const, sourceSpan: { start: 520, end: 595 } },
  { label: "ANTICIPO", value: "$345,000.00 MXN (10%)", group: "INMUEBLE", confidence: "ALTA" as const, sourceSpan: { start: 600, end: 622 } },
  { label: "PLAZO_CIERRE", value: "30 días hábiles contados a partir de la firma del presente contrato", group: "FECHAS", confidence: "MEDIA" as const, sourceSpan: { start: 650, end: 720 } },
  { label: "CONDICION_ESPECIAL", value: "El vendedor entrega el inmueble libre de gravámenes y deudas de servicios", group: "INMUEBLE", confidence: "BAJA" as const, sourceSpan: { start: 740, end: 810 } },
];

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface AnalysisResult {
  documentId: string;
  status: string;
  progress: number;
  startedAt: string;
  completedAt: string | null;
  entities: AnalysisEntity[];
}

export interface AnalysisEntity {
  id: string;
  label: string;
  value: string;
  group: string;
  confidence: string;
  sourceSpan: { start: number; end: number } | null;
  reviewed: boolean;
  excluded: boolean;
}

export interface AnalysisStatus {
  documentId: string;
  status: string;
  progress: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AnalysisService {
  public constructor(private readonly postgres: PostgresService) {}

  /**
   * GET /:id — Returns the full analysis result, including entities.
   * On each call while "processing", increments progress by 25.
   * When progress reaches 100, marks as "completed" and inserts sample entities.
   * Once "completed", returns idempotently without re-inserting entities.
   */
  async getFullResult(documentId: string): Promise<AnalysisResult> {
    return this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const analysisRepo = new AnalysisResultsRepository(client);

      // Find the analysis result by documentId
      const results = await analysisRepo.findByDocumentId(documentId);

      if (results.length === 0) {
        throw new NotFoundException("Analysis result not found");
      }

      const result = results[0];

      // If already completed, return as-is (idempotent)
      if (result.status === "completed") {
        const entitiesRepo = new EntitiesRepository(client);
        const entities = await entitiesRepo.findByAnalysisResultId(result.id);

        return this.mapToAnalysisResult(result, entities);
      }

      // If terminal (failed/pending) — return without incrementing progress
      if (result.status === "failed" || result.status === "pending") {
        return this.mapToAnalysisResult(result, []);
      }

      // Processing path: increment progress
      const incremented = await analysisRepo.incrementProgress(result.id);

      if (!incremented) {
        throw new NotFoundException("Analysis result not found after increment");
      }

      // Check if we've reached 100% — if so, complete and insert sample entities
      if (incremented.progress >= 100) {
        const completed = await analysisRepo.updateStatus(result.id, "completed");

        if (!completed) {
          throw new NotFoundException("Analysis result not found after status update");
        }

        // Guard against duplicate insertion from concurrent requests
        const entitiesRepo = new EntitiesRepository(client);
        const existingEntities = await entitiesRepo.findByAnalysisResultId(result.id);

        if (existingEntities.length === 0) {
          // Insert sample entities (only if none exist yet)
          const entityInputs = SAMPLE_ENTITIES.map((e) => ({
            analysisResultId: result.id,
            documentId,
            label: e.label,
            value: e.value,
            group: e.group,
            confidence: e.confidence,
            sourceSpan: e.sourceSpan,
          }));

          await entitiesRepo.bulkInsert(entityInputs);
        }

        // Fetch the entities (whether just inserted or from a concurrent request)
        const insertedEntities = await entitiesRepo.findByAnalysisResultId(result.id);

        return this.mapToAnalysisResult(completed, insertedEntities);
      }

      // Still processing — return incremented result with empty entities
      return this.mapToAnalysisResult(incremented, []);
    });
  }

  /**
   * GET /:id/status — Lightweight endpoint returning only documentId, status, progress.
   * Also drives progress: increments on each poll, transitions to "completed" at 100.
   * This matches the MSW contract where /status also drives progress.
   */
  async getStatus(documentId: string): Promise<AnalysisStatus> {
    return this.postgres.withOwnerTransaction(0, async ({ client }) => {
      const analysisRepo = new AnalysisResultsRepository(client);

      const results = await analysisRepo.findByDocumentId(documentId);

      if (results.length === 0) {
        throw new NotFoundException("Analysis result not found");
      }

      const result = results[0];

      // Terminal states: return immediately without incrementing
      if (result.status === "completed" || result.status === "failed" || result.status === "pending") {
        return {
          documentId: result.documentId,
          status: result.status,
          progress: result.progress,
        };
      }

      // Processing: increment progress
      const incremented = await analysisRepo.incrementProgress(result.id);

      if (!incremented) {
        throw new NotFoundException("Analysis result not found after increment");
      }

      // Transition to completed if progress reaches 100
      if (incremented.progress >= 100) {
        const completed = await analysisRepo.updateStatus(result.id, "completed");

        if (!completed) {
          throw new NotFoundException("Analysis result not found after status update");
        }

        return {
          documentId: completed.documentId,
          status: "completed",
          progress: completed.progress,
        };
      }

      return {
        documentId: incremented.documentId,
        status: incremented.status,
        progress: incremented.progress,
      };
    });
  }

  private mapToAnalysisResult(
    record: import("../infrastructure/postgres/repositories/analysis-results.repository").AnalysisResultRecord,
    entities: import("../infrastructure/postgres/repositories/entities.repository").EntityRecord[],
  ): AnalysisResult {
    return {
      documentId: record.documentId,
      status: record.status,
      progress: record.progress,
      startedAt: record.startedAt.toISOString(),
      completedAt: record.completedAt ? record.completedAt.toISOString() : null,
      entities: entities.map((e) => ({
        id: e.id,
        label: e.label,
        value: e.value,
        group: e.group,
        confidence: e.confidence,
        sourceSpan: e.sourceSpan,
        reviewed: e.reviewed,
        excluded: e.excluded,
      })),
    };
  }
}