import type { Document, Entity, Template } from "@template-ai/contracts";

// ---------------------------------------------------------------------------
// Realistic test fixtures matching packages/contracts/src/schemas.ts
// ---------------------------------------------------------------------------

/** A realistic PDF contract document in pending state */
export const SAMPLE_DOCUMENT: Document = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  filename: "contrato-compraventa-inmueble.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2_457_344, // ~2.3 MB
  status: "pending",
  uploadedAt: "2026-05-27T10:30:00.000Z",
};

/** 11 entities extracted from a real estate purchase contract */
export const SAMPLE_ENTITIES: Entity[] = [
  {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    label: "COMPRADOR",
    value: "María González López",
    group: "PARTES",
    confidence: "ALTA",
    sourceSpan: { start: 142, end: 163 },
    reviewed: false,
  },
  {
    id: "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    label: "VENDEDOR",
    value: "Carlos Rodríguez Pérez",
    group: "PARTES",
    confidence: "ALTA",
    sourceSpan: { start: 165, end: 186 },
    reviewed: false,
  },
  {
    id: "c3d4e5f6-a7b8-9012-cdef-123456789012",
    label: "INMUEBLE",
    value: "Departamento en Av. Reforma 1234, Piso 8, Col. Juárez, CDMX",
    group: "INMUEBLE",
    confidence: "ALTA",
    sourceSpan: { start: 220, end: 285 },
    reviewed: false,
  },
  {
    id: "d4e5f6a7-b8c9-0123-defa-234567890123",
    label: "PRECIO_TOTAL",
    value: "$3,450,000.00 MXN",
    group: "INMUEBLE",
    confidence: "MEDIA",
    sourceSpan: { start: 310, end: 325 },
    reviewed: false,
  },
  {
    id: "e5f6a7b8-c9d0-1234-efab-345678901234",
    label: "FECHA_FIRMA",
    value: "15 de junio de 2026",
    group: "FECHAS",
    confidence: "ALTA",
    sourceSpan: { start: 400, end: 420 },
    reviewed: false,
  },
  {
    id: "f6a7b8c9-d0e1-2345-fabc-456789012345",
    label: "ESCRITURA_NUMERO",
    value: "4,218",
    group: "ANEXOS",
    confidence: "BAJA",
    sourceSpan: { start: 445, end: 450 },
    reviewed: false,
  },
  {
    id: "a7b8c9d0-e1f2-3456-abcd-567890123456",
    label: "NOTARIO",
    value: "Lic. Patricia Hernández Vega",
    group: "ANEXOS",
    confidence: "ALTA",
    sourceSpan: { start: 470, end: 498 },
    reviewed: false,
  },
  {
    id: "b8c9d0e1-f2a3-4567-bcde-678901234567",
    label: "METODO_PAGO",
    value: "Transferencia bancaria por $1,725,000 y cheque de caja por $1,725,000",
    group: "INMUEBLE",
    confidence: "MEDIA",
    sourceSpan: { start: 520, end: 595 },
    reviewed: false,
  },
  {
    id: "c9d0e1f2-a3b4-5678-cdef-789012345678",
    label: "ANTICIPO",
    value: "$345,000.00 MXN (10%)",
    group: "INMUEBLE",
    confidence: "ALTA",
    sourceSpan: { start: 600, end: 622 },
    reviewed: false,
  },
  {
    id: "d0e1f2a3-b4c5-6789-defa-890123456789",
    label: "PLAZO_CIERRE",
    value: "30 días hábiles contados a partir de la firma del presente contrato",
    group: "FECHAS",
    confidence: "MEDIA",
    sourceSpan: { start: 650, end: 720 },
    reviewed: false,
  },
  {
    id: "e1f2a3b4-c5d6-7890-efab-901234567890",
    label: "CONDICION_ESPECIAL",
    value: "El vendedor entrega el inmueble libre de gravámenes y deudas de servicios",
    group: "INMUEBLE",
    confidence: "BAJA",
    sourceSpan: { start: 740, end: 810 },
    reviewed: false,
  },
];

/** Analysis result in completed state with all entities */
export const SAMPLE_ANALYSIS_RESULT = {
  documentId: "550e8400-e29b-41d4-a716-446655440000",
  status: "completed",
  entities: SAMPLE_ENTITIES,
  progress: 100,
  startedAt: "2026-05-27T10:30:05.000Z",
  completedAt: "2026-05-27T10:35:22.000Z",
};

/** In-progress analysis result — used to simulate polling */
export const SAMPLE_ANALYSIS_PROCESSING = {
  documentId: "550e8400-e29b-41d4-a716-446655440000",
  status: "processing",
  entities: [] as Entity[],
  progress: 45,
  startedAt: "2026-05-27T10:30:05.000Z",
};

/** A saved template from the review flow */
export const SAMPLE_TEMPLATE: Template = {
  id: "f0a1b2c3-d4e5-6789-a1b2-c3d4e5f67890",
  name: "Contrato de compraventa - CDMX",
  description:
    "Plantilla estándar para contratos de compraventa de inmuebles en la Ciudad de México, incluyendo partes, inmueble, precio y condiciones de cierre.",
  documentId: "550e8400-e29b-41d4-a716-446655440000",
  entities: SAMPLE_ENTITIES,
  category: "Contratos",
  createdAt: "2026-05-27T11:00:00.000Z",
  status: "draft",
};