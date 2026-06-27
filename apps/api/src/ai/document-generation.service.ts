import { Injectable, Logger } from "@nestjs/common";
import { OpenRouterService, OpenRouterError } from "./open-router.service.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateInput {
  entities: Array<{
    id: string;
    label: string;
    value: string;
    group: string;
  }>;
  formData: Record<string, string>;
  baseText: string | null;
}

export interface GenerateResult {
  success: boolean;
  generatedText?: string;
  baseTextMissing?: boolean;
  error?: string;
  errorType?: string;
}

// ---------------------------------------------------------------------------
// Prompt construction
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Eres un asistente especializado en generación de documentos legales mexicanos.
Genera un documento legal completo basado en las entidades proporcionadas y los datos del formulario.

Reglas:
- Preserva la estructura del documento base si está disponible.
- Sustituye solo los valores proporcionados por el usuario.
- Usa [COMPLETAR: <nombre del campo>] para campos críticos sin valor.
- Responde EXCLUSIVAMENTE con un JSON object: { "generatedText": "..." }
- No incluyas texto adicional fuera del JSON.`;

const SYSTEM_PROMPT_NO_BASE = `Eres un asistente especializado en generación de documentos legales mexicanos.
Genera un documento legal completo basado en las entidades y datos del formulario proporcionados.
No dispones de un documento base — genera el documento desde cero usando los datos disponibles.

Reglas:
- Usa [COMPLETAR: <nombre del campo>] para campos críticos sin valor.
- Responde EXCLUSIVAMENTE con un JSON object: { "generatedText": "..." }
- No incluyas texto adicional fuera del JSON.`;

function buildUserPrompt(input: GenerateInput): string {
  const lines: string[] = [];

  // Entities with user-provided values
  lines.push("## Entidades del documento");
  for (const entity of input.entities) {
    const value = input.formData[entity.id] ?? entity.value ?? "";
    lines.push(`- ${entity.label} (${entity.group}): ${value || "[sin valor]"}`);
  }

  // Base text (if available)
  if (input.baseText) {
    lines.push("");
    lines.push("## Documento base");
    lines.push(input.baseText);
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class DocumentGenerationService {
  private readonly logger = new Logger(DocumentGenerationService.name);

  constructor(private readonly openRouterService: OpenRouterService) {}

  /**
   * Generate a legal document from template entities, form data, and optional
   * base text. Retries up to 3 attempts on transient errors.
   */
  async generate(input: GenerateInput): Promise<GenerateResult> {
    const systemPrompt = input.baseText
      ? SYSTEM_PROMPT
      : SYSTEM_PROMPT_NO_BASE;
    const userPrompt = buildUserPrompt(input);

    try {
      const result = await this.callWithRetry(systemPrompt, userPrompt);
      return {
        success: true,
        generatedText: result.generatedText,
        baseTextMissing: input.baseText === null ? true : undefined,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Document generation failed";
      const errorType =
        error instanceof OpenRouterError ? error.code : "UNKNOWN";

      return {
        success: false,
        error: message,
        errorType,
      };
    }
  }

  /**
   * Call AI generation with exponential backoff on retryable errors.
   * 3 attempts total with 1s, 3s backoff.
   */
  private async callWithRetry(
    systemPrompt: string,
    userPrompt: string,
  ): Promise<{ generatedText: string }> {
    const retryableCodes = ["RATE_LIMIT", "NETWORK_ERROR", "INVALID_RESPONSE"];
    const delays = [1_000, 3_000];
    let lastError: unknown;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        if (attempt > 0) {
          const delay = delays[attempt - 1];
          this.logger.warn(
            `Generation call failed (attempt ${attempt}) — retrying in ${delay / 1000}s...`,
          );
          await sleep(delay);
        }
        return await this.openRouterService.generateDocument(
          systemPrompt,
          userPrompt,
        );
      } catch (error) {
        lastError = error;
        if (
          error instanceof OpenRouterError &&
          retryableCodes.includes(error.code) &&
          attempt < delays.length
        ) {
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }
}
