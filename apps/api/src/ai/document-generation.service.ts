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
   * Delegate to OpenRouterService.generateDocument.
   * Retry is handled internally by callWithRetryChain (3 primary + 1 fallback).
   */
  private async callWithRetry(
    task: "generation" | "generation-no-base",
    vars: Record<string, string>,
  ): Promise<{ generatedText: string }> {
    return this.openRouterService.generateDocument(task, vars);
  }
}
