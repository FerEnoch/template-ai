import { Injectable, Logger } from "@nestjs/common";
import OpenAI from "openai";
import { z } from "zod";
import { AI_CONFIG } from "../config/ai.js";

// ---------------------------------------------------------------------------
// Schema for validating AI response entities
// ---------------------------------------------------------------------------

const AiEntitySchema = z.object({
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
});

const AiEntityArraySchema = z.array(AiEntitySchema);

export type AiEntity = z.infer<typeof AiEntitySchema>;

export interface ExtractEntitiesResult {
  entities: AiEntity[];
  rawResponse: string;
}

// ---------------------------------------------------------------------------
// Custom error class
// ---------------------------------------------------------------------------

export class OpenRouterError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "OpenRouterError";
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Spanish system prompt with few-shot examples
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Eres un asistente especializado en análisis de documentos legales mexicanos.
Extrae las entidades clave del documento proporcionado.

Para cada entidad, identifica:
- label: nombre del campo (ej: COMPRADOR, VENDEDOR, PRECIO_TOTAL)
- value: valor exacto encontrado en el documento
- group: categoría (PARTES, INMUEBLE, FECHAS, ANEXOS)
- confidence: nivel de confianza (ALTA, MEDIA, BAJA)
- sourceSpan: posición aproximada en el texto (start, end) si es posible

Responde EXCLUSIVAMENTE con un JSON array de entidades. No incluyas texto adicional.

Ejemplo de entrada:
"Contrato de compraventa entre Juan Pérez (comprador) y María López (vendedora) del inmueble ubicado en Av. Reforma 1234, CDMX, por un precio de $2,000,000 MXN, firmado el 20 de marzo de 2026."

Ejemplo de salida:
[
  {"label": "COMPRADOR", "value": "Juan Pérez", "group": "PARTES", "confidence": "ALTA", "sourceSpan": {"start": 34, "end": 43}},
  {"label": "VENDEDORA", "value": "María López", "group": "PARTES", "confidence": "ALTA", "sourceSpan": {"start": 57, "end": 68}},
  {"label": "PRECIO_TOTAL", "value": "$2,000,000 MXN", "group": "INMUEBLE", "confidence": "ALTA", "sourceSpan": {"start": 110, "end": 125}}
]

Ejemplo de entrada:
"Escritura pública número 15,234 otorgada ante el Notario Público Lic. Roberto Díaz, fecha de operación 5 de enero de 2026, anexo: plano arquitectónico del departamento 402."

Ejemplo de salida:
[
  {"label": "ESCRITURA_NUMERO", "value": "15,234", "group": "ANEXOS", "confidence": "ALTA"},
  {"label": "NOTARIO", "value": "Lic. Roberto Díaz", "group": "ANEXOS", "confidence": "MEDIA"},
  {"label": "FECHA_OPERACION", "value": "5 de enero de 2026", "group": "FECHAS", "confidence": "ALTA"},
  {"label": "ANEXO", "value": "plano arquitectónico del departamento 402", "group": "ANEXOS", "confidence": "BAJA"}
]`;

const JSON_SCHEMA = {
  type: "object" as const,
  additionalProperties: false,
  properties: {
    entities: {
      type: "array" as const,
      items: {
        type: "object" as const,
        additionalProperties: false,
        properties: {
          label: { type: "string" as const },
          value: { type: "string" as const },
          group: {
            type: "string" as const,
            enum: ["PARTES", "INMUEBLE", "FECHAS", "ANEXOS"],
          },
          confidence: {
            type: "string" as const,
            enum: ["ALTA", "MEDIA", "BAJA"],
          },
          sourceSpan: {
            type: "object" as const,
            additionalProperties: false,
            properties: {
              start: { type: "number" as const },
              end: { type: "number" as const },
            },
          },
        },
        required: ["label", "value", "group", "confidence"] as const,
      },
    },
  },
  required: ["entities"] as const,
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class OpenRouterService {
  private readonly client: OpenAI;
  private readonly logger = new Logger(OpenRouterService.name);

  constructor() {
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: AI_CONFIG.apiKey,
      defaultHeaders: {
        "X-Title": "Template AI",
        "HTTP-Referer": "https://template-ai.local",
      },
    });
  }

  async extractEntities(documentText: string): Promise<ExtractEntitiesResult> {
    const model = AI_CONFIG.model;
    if (!model) {
      throw new OpenRouterError(
        "AI_MODEL is not configured. Set AI_MODEL in your environment.",
        "MODEL_NOT_CONFIGURED",
      );
    }

    try {
      return await this.callModel(model, documentText);
    } catch (error) {
      // Fallback: retry with secondary model on MODEL_NOT_FOUND or RATE_LIMIT
      if (
        error instanceof OpenRouterError &&
        (error.code === "MODEL_NOT_FOUND" || error.code === "RATE_LIMIT") &&
        AI_CONFIG.modelFallback
      ) {
        const reason = error.code === "RATE_LIMIT" ? "rate limited" : "not found";
        this.logger.warn(
          `Primary model "${model}" ${reason} — falling back to "${AI_CONFIG.modelFallback}"`,
        );
        return await this.callModel(AI_CONFIG.modelFallback, documentText);
      }

      throw error;
    }
  }

  /**
   * Execute the AI extraction call against a specific model.
   * Extracted to enable model fallback without duplicating the try/catch logic.
   */
  private async callModel(model: string, documentText: string): Promise<ExtractEntitiesResult> {
    try {
      const response = await this.client.chat.completions.create({
        model,
        max_tokens: AI_CONFIG.maxTokens,
        temperature: AI_CONFIG.temperature,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "entities",
            strict: true,
            schema: JSON_SCHEMA,
          },
        },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: documentText },
        ],
      });

      const rawResponse = response.choices[0]?.message?.content ?? "";

      // Strip markdown fences — some models wrap JSON in ```json blocks
      // despite json_schema mode.
      const stripMarkdownFences = (text: string): string => {
        const trimmed = text.trim();
        const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
        return fenceMatch ? fenceMatch[1].trim() : trimmed;
      };

      let parsed: unknown;
      try {
        parsed = JSON.parse(stripMarkdownFences(rawResponse));
      } catch (parseError) {
        this.logger.error(
          `Invalid JSON from model ${model}: ${(parseError as Error).message}`,
        );
        this.logger.debug(
          `Raw response (first 1000 chars): ${rawResponse.substring(0, 1000)}`,
        );
        throw new OpenRouterError(
          `Invalid JSON response from ${model}: ${(parseError as Error).message}`,
          "INVALID_RESPONSE",
        );
      }

      // Narrow parsed from unknown: if it's an object with an "entities" key,
      // unwrap it (json_schema mode wraps output). Otherwise use the raw value
      // directly (model might return a bare array).
      const entityArray: unknown =
        parsed !== null &&
        typeof parsed === "object" &&
        !Array.isArray(parsed) &&
        "entities" in parsed
          ? (parsed as Record<string, unknown>).entities
          : parsed;

      const result = AiEntityArraySchema.safeParse(entityArray);

      if (!result.success) {
        // Filter invalid entities: keep only valid ones
        const validEntities: AiEntity[] = [];
        if (Array.isArray(entityArray)) {
          for (const item of entityArray) {
            const itemResult = AiEntitySchema.safeParse(item);
            if (itemResult.success) {
              validEntities.push(itemResult.data);
            }
          }
        }

        if (validEntities.length === 0) {
          throw new OpenRouterError(
            `Zod validation failed: ${result.error.message}`,
            "INVALID_RESPONSE",
          );
        }

        return { entities: validEntities, rawResponse };
      }

      return { entities: result.data, rawResponse };
    } catch (error) {
      if (error instanceof OpenRouterError) {
        throw error;
      }

      // Safety net: catch any SyntaxError that escapes JSON.parse protection.
      // Should not happen after B1 try/catch, but guards against future regressions.
      if (error instanceof SyntaxError) {
        this.logger.error(
          `Unprotected JSON.parse failed: ${error.message}`,
        );
        throw new OpenRouterError(
          `Invalid JSON response: ${error.message}`,
          "INVALID_RESPONSE",
        );
      }

      // Check for API errors with status codes (OpenAI.APIError or similar)
      const status = (error as { status?: number })?.status ?? 0;

      if (status === 401) {
        throw new OpenRouterError("Invalid OPENROUTER_API_KEY", "AUTH_ERROR");
      }

      if (status === 404) {
        throw new OpenRouterError(
          `Model not found: ${model}`,
          "MODEL_NOT_FOUND",
        );
      }

      if (status === 429) {
        throw new OpenRouterError("Rate limit exceeded", "RATE_LIMIT");
      }

      if (status > 0) {
        throw new OpenRouterError(
          `OpenRouter API error: ${error instanceof Error ? error.message : String(error)}`,
          "API_ERROR",
        );
      }

      throw new OpenRouterError(
        `OpenRouter API unreachable: ${error instanceof Error ? error.message : String(error)}`,
        "NETWORK_ERROR",
      );
    }
  }
}