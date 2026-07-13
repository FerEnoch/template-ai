import { Injectable, Logger } from "@nestjs/common";
import { OpenRouterService, OpenRouterError } from "./open-router.service.js";
import { VerificationService, type VerificationResult } from "./verification.service.js";

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
  verification?: VerificationResult;
}

// ---------------------------------------------------------------------------
// Prompt variable construction
// ---------------------------------------------------------------------------

function formatEntities(input: GenerateInput): string {
  const lines: string[] = [];

  for (const entity of input.entities) {
    const value = input.formData[entity.id] ?? entity.value ?? "";
    lines.push(`- ${entity.label} (${entity.group}): ${value || "[sin valor]"}`);
  }

  return lines.join("\n");
}

function formatFormData(input: GenerateInput): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(input.formData)) {
    lines.push(`- ${key}: ${value || "[sin valor]"}`);
  }

  return lines.join("\n");
}

function buildGenerationVars(input: GenerateInput): Record<string, string> {
  const vars: Record<string, string> = {
    entities: formatEntities(input),
    formData: formatFormData(input),
  };

  if (input.baseText) {
    vars.baseText = input.baseText;
  }

  return vars;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class DocumentGenerationService {
  private readonly logger = new Logger(DocumentGenerationService.name);

  constructor(
    private readonly openRouterService: OpenRouterService,
    private readonly verificationService: VerificationService,
  ) {}

  /**
   * Generate a legal document from template entities, form data, and optional
   * base text. Retries up to 3 attempts on transient errors.
   */
  async generate(input: GenerateInput): Promise<GenerateResult> {
    const task = input.baseText ? "generation" : "generation-no-base";
    const vars = buildGenerationVars(input);

    try {
      const result = await this.callWithRetry(task, vars);
      const verification = await this.verificationService.verify(
        result.generatedText,
      );
      return {
        success: true,
        generatedText: result.generatedText,
        baseTextMissing: input.baseText === null ? true : undefined,
        verification,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Document generation failed";
      const errorType =
        error instanceof OpenRouterError ? error.code : "UNKNOWN";

      this.logger.error(
        "Document generation failed",
        error instanceof Error ? error.stack : String(error),
      );

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
    task: "generation" | "generation-no-base",
    vars: Record<string, string>,
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
        return await this.openRouterService.generateDocument(task, vars);
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
