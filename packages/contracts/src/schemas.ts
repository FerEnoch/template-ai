import { z } from "zod";

// Document schema: represents an uploaded file awaiting analysis
export const DocumentSchema = z.object({
  id: z.string().uuid(),
  filename: z.string().min(1),
  mimeType: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
  ]),
  sizeBytes: z.number().min(1).max(25 * 1024 * 1024),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  uploadedAt: z.string().datetime(),
});

// Entity schema: a single extracted piece of information from a document
export const EntitySchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  value: z.string(),
  group: z.enum(["PARTES", "INMUEBLE", "FECHAS", "ANEXOS"]),
  confidence: z.enum(["ALTA", "MEDIA", "BAJA"]),
  sourceSpan: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  reviewed: z.boolean().default(false),
  excluded: z.boolean().default(false),
});

// Analysis result schema: outcome of document analysis job
export const AnalysisResultSchema = z.object({
  documentId: z.string().uuid(),
  status: z.enum(["pending", "processing", "completed", "failed"]),
  entities: z.array(EntitySchema),
  progress: z.number().min(0).max(100),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

// Template schema: a saved document template ready for reuse
export const TemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(3).max(200),
  description: z.string().max(1000),
  documentId: z.string().uuid(),
  entities: z.array(EntitySchema),
  category: z.string(),
  createdAt: z.string().datetime(),
  status: z.enum(["draft", "published", "archived"]),
});

// Wizard draft schema: transient form state for the wizard flow
export const WizardDraftSchema = z.object({
  version: z.literal(1),
  file: z.object({
    name: z.string(),
    size: z.number(),
    type: z.string(),
  }),
  analysisResultId: z.string().uuid().optional(),
  entities: z.array(EntitySchema).optional(),
  templateForm: z
    .object({
      name: z.string().min(3).max(200),
      description: z.string().max(1000),
      category: z.string(),
    })
    .optional(),
  savedAt: z.string().datetime(),
});

// Infer types from schemas
export type Document = z.infer<typeof DocumentSchema>;
export type Entity = z.infer<typeof EntitySchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type Template = z.infer<typeof TemplateSchema>;
export type WizardDraft = z.infer<typeof WizardDraftSchema>;
