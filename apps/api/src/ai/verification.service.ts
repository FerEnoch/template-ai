import { Injectable, Logger } from "@nestjs/common";
import OpenAI from "openai";
import { z } from "zod";
import { AI_CONFIG } from "../config/ai.js";
import { PromptEngine } from "./prompt-engine.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VerificationResult {
  passed: boolean;
  completarCount: number;
  warnings: string[];
  degraded?: boolean;
}

const VerificationResponseSchema = z.object({
  passed: z.boolean(),
  completarCount: z.number().int().min(0),
  warnings: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class VerificationService {
  private readonly client: OpenAI;
  private readonly logger = new Logger(VerificationService.name);

  constructor(private readonly promptEngine: PromptEngine) {
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: AI_CONFIG.apiKey,
      defaultHeaders: {
        "X-Title": "Template AI",
        "HTTP-Referer": "https://template-ai.local",
      },
    });
  }

  /**
   * Verify a generated document for unresolved `[COMPLETAR]` markers and
   * structural integrity using a cheap/fast model. The result is advisory:
   * it never throws and never blocks the download.
   */
  async verify(generatedText: string): Promise<VerificationResult> {
    const model = AI_CONFIG.modelFallback ?? AI_CONFIG.model;
    if (!model) {
      this.logger.warn("Verification skipped: no AI_MODEL or AI_MODEL_FALLBACK configured");
      return this.degradedResult(
        generatedText,
        "Verification skipped: no model configured.",
      );
    }

    try {
      const systemPrompt = await this.promptEngine.renderWithSafety(
        "verification",
        { generatedText },
      );

      const response = await this.client.chat.completions.create({
        model,
        max_tokens: 2048,
        temperature: 0,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Verificá el documento generado." },
        ],
      });

      const rawContent = response.choices[0]?.message?.content ?? "";
      const parsed: unknown = JSON.parse(this.stripMarkdownFences(rawContent));
      const validation = VerificationResponseSchema.safeParse(parsed);

      if (!validation.success) {
        this.logger.warn(
          `Verification response shape invalid: ${validation.error.message}`,
        );
        return this.degradedResult(
          generatedText,
          `Verification response invalid: ${validation.error.message}`,
        );
      }

      return validation.data;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.logger.warn(`Verification model failed: ${message}`);
      return this.degradedResult(
        generatedText,
        `Verification model failed: ${message}`,
      );
    }
  }

  /**
   * Build a degraded result when the verification model cannot be trusted.
   * Performs a local scan for `[COMPLETAR]` markers so the caller still gets
   * useful warnings.
   */
  private degradedResult(
    generatedText: string,
    degradationWarning: string,
  ): VerificationResult {
    const warnings = [degradationWarning];
    const matches = generatedText.match(/\[COMPLETAR\]/g);
    const completarCount = matches?.length ?? 0;

    if (completarCount > 0) {
      warnings.push(
        `Detected ${completarCount} unresolved [COMPLETAR] marker(s).`,
      );
    }

    if (generatedText.trim().length === 0) {
      warnings.push("Generated document is empty.");
    }

    return {
      passed: true,
      completarCount,
      warnings,
      degraded: true,
    };
  }

  /**
   * Strip markdown fences — some models wrap JSON in ```json blocks despite
   * structured instructions.
   */
  private stripMarkdownFences(text: string): string {
    const trimmed = text.trim();
    const fenceMatch = trimmed.match(
      /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/,
    );
    return fenceMatch ? fenceMatch[1].trim() : trimmed;
  }
}
