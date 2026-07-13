import { Inject, Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import OpenAI from "openai";
import { z } from "zod";
import { AI_CONFIG, CACHE_CONFIG, AI_GENERATION_CONFIG } from "../config/ai.js";
import { CACHE_PORT, type CachePort } from "../infrastructure/redis/index.js";
import { PromptEngine } from "./prompt-engine.js";
import { resolveModelChain, type AiTask } from "./model-router.js";
import { SEED_GROUPS } from "./groups.service.js";

// ---------------------------------------------------------------------------
// Schema for validating AI response entities
// ---------------------------------------------------------------------------

const SourceSpanSchema = z
  .object({
    start: z.number(),
    end: z.number(),
  })
  .optional();

const AiEntitySchema = z.object({
  label: z.string(),
  value: z.string(),
  group: z.string().min(1),
  confidence: z.enum(["ALTA", "MEDIA", "BAJA"]),
  sourceSpan: SourceSpanSchema,
});

const AiEntityArraySchema = z.array(AiEntitySchema);

export type AiEntity = z.infer<typeof AiEntitySchema>;

export interface ExtractEntitiesResult {
  entities: AiEntity[];
  rawResponse: string;
  suggestedGroups?: string[];
}

export interface ExtractEntitiesInput {
  documentText: string;
  userId: number;
  groups: string[];
  fewShot?: string;
}

// ---------------------------------------------------------------------------
// Custom error class
// ---------------------------------------------------------------------------

export class OpenRouterError extends Error {
  public readonly code: string;
  public readonly status?: number;
  public readonly body?: unknown;

  constructor(message: string, code: string, status?: number, body?: unknown) {
    super(message);
    this.name = "OpenRouterError";
    this.code = code;
    this.status = status;
    this.body = body;
  }
}

// ---------------------------------------------------------------------------
// Classification result schema
// ---------------------------------------------------------------------------

const ClassifyResultSchema = z.object({
  label: z.string().min(1),
  group: z.string().min(1),
  value: z.string(),
});

export type ClassifyResult = z.infer<typeof ClassifyResultSchema>;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class OpenRouterService {
  private readonly client: OpenAI;
  private readonly logger = new Logger(OpenRouterService.name);

  constructor(
    @Inject(CACHE_PORT) private readonly cachePort: CachePort,
    private readonly promptEngine: PromptEngine,
  ) {
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: AI_CONFIG.apiKey,
      defaultHeaders: {
        "X-Title": "Template AI",
        "HTTP-Referer": "https://template-ai.local",
      },
    });
  }

  async extractEntities(
    input: ExtractEntitiesInput,
  ): Promise<ExtractEntitiesResult> {
    const model = AI_CONFIG.model;
    if (!model) {
      throw new OpenRouterError(
        "AI_MODEL is not configured. Set AI_MODEL in your environment.",
        "MODEL_NOT_CONFIGURED",
      );
    }

    const cacheKey = createHash("sha256")
      .update(
        JSON.stringify({
          documentText: input.documentText,
          userId: input.userId,
          groups: input.groups,
          fewShot: input.fewShot ?? "",
        }),
      )
      .digest("hex");

    if (CACHE_CONFIG.enabled) {
      return this.cachePort.getOrSet(
        `ai:resp:${cacheKey}`,
        CACHE_CONFIG.responseCacheTtl,
        () => this.callExtractWithRetryChain(input),
      );
    }

    return this.callExtractWithRetryChain(input);
  }

  private async callExtractWithRetryChain(
    input: ExtractEntitiesInput,
  ): Promise<ExtractEntitiesResult> {
    const systemPrompt = await this.promptEngine.renderWithSafety(
      "extraction",
      {
        groups: input.groups.map((g) => `- ${g}`).join("\n"),
        fewShot: input.fewShot ?? "",
        documentText: input.documentText,
      },
    );

    const rawResponse = await this.callWithRetryChain(
      "extraction",
      systemPrompt,
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(this.stripMarkdownFences(rawResponse));
    } catch (parseError) {
      this.logger.error(
        `Invalid JSON from extraction: ${(parseError as Error).message}`,
      );
      this.logger.debug(
        `Raw response (first 1000 chars): ${rawResponse.substring(0, 1000)}`,
      );
      throw new OpenRouterError(
        `Invalid JSON response from extraction: ${(parseError as Error).message}`,
        "INVALID_RESPONSE",
      );
    }

    const entityArray: unknown =
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      "entities" in parsed
        ? (parsed as Record<string, unknown>).entities
        : parsed;

    const suggestedGroups = this.parseSuggestedGroups(parsed);

    const result = AiEntityArraySchema.safeParse(entityArray);

    if (!result.success) {
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

      return { entities: validEntities, rawResponse, suggestedGroups };
    }

    return { entities: result.data, rawResponse, suggestedGroups };
  }

  private parseSuggestedGroups(parsed: unknown): string[] | undefined {
    if (
      parsed === null ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      !("suggestedGroups" in parsed)
    ) {
      return undefined;
    }

    const raw = (parsed as Record<string, unknown>).suggestedGroups;
    if (!Array.isArray(raw)) {
      return undefined;
    }

    const groups = raw.filter(
      (item): item is string => typeof item === "string" && item.length > 0,
    );

    return groups.length > 0 ? groups : undefined;
  }

  /**
   * Call the AI for a task using a retry chain:
   * - Primary model: up to 3 attempts on retryable errors.
   * - Each fallback model: 1 attempt.
   * - MODEL_NOT_FOUND moves to the next model immediately.
   * - AUTH_ERROR and API_ERROR fail fast without fallback.
   */
  private async callWithRetryChain(
    task: AiTask,
    systemPrompt: string,
  ): Promise<string> {
    const chain = resolveModelChain(task);
    const retryableCodes = ["RATE_LIMIT", "NETWORK_ERROR", "INVALID_RESPONSE"];
    const fallbackTriggerCodes = ["MODEL_NOT_FOUND"];
    const fatalCodes = ["AUTH_ERROR", "API_ERROR"];
    let lastError: OpenRouterError | undefined;

    for (let modelIndex = 0; modelIndex < chain.length; modelIndex++) {
      const model = chain[modelIndex]!;
      const isPrimary = modelIndex === 0;
      const maxAttempts = isPrimary ? 3 : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          return await this.callModel(model, systemPrompt, task);
        } catch (error) {
          if (!(error instanceof OpenRouterError)) {
            throw error;
          }

          lastError = error;

          if (fatalCodes.includes(error.code)) {
            throw error;
          }

          if (fallbackTriggerCodes.includes(error.code)) {
            this.logger.warn(
              `Model "${model}" ${error.code === "MODEL_NOT_FOUND" ? "not found" : "unavailable"} — falling back`,
            );
            break;
          }

          if (!retryableCodes.includes(error.code)) {
            throw error;
          }

          if (isPrimary && attempt < maxAttempts - 1) {
            this.logger.warn(
              `${task} call failed with ${error.code} on "${model}" (attempt ${attempt + 1}/${maxAttempts}) — retrying`,
            );
          }
        }
      }
    }

    throw (
      lastError ??
      new OpenRouterError(
        `All models in the ${task} chain failed`,
        "NETWORK_ERROR",
      )
    );
  }

  /**
   * Classify a single text span with surrounding context.
   * Uses the classification prompt with temperature=0, max_tokens=150 for fast,
   * deterministic results.
   */
  async classifySpan(
    text: string,
    context: string,
    groups: string[] = [...SEED_GROUPS],
  ): Promise<ClassifyResult> {
    const systemPrompt = await this.promptEngine.renderWithSafety(
      "classification",
      {
        groups: groups.map((g) => `- ${g}`).join("\n"),
        span: text,
        context,
      },
    );

    const rawResponse = await this.callWithRetryChain(
      "classification",
      systemPrompt,
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(this.stripMarkdownFences(rawResponse));
    } catch (parseError) {
      this.logger.error(
        `Invalid JSON from classifySpan: ${(parseError as Error).message}`,
      );
      throw new OpenRouterError(
        `Invalid JSON response from classifySpan: ${(parseError as Error).message}`,
        "INVALID_RESPONSE",
      );
    }

    const result = ClassifyResultSchema.safeParse(parsed);
    if (!result.success) {
      throw new OpenRouterError(
        `Zod validation failed for classifySpan: ${result.error.message}`,
        "INVALID_RESPONSE",
      );
    }

    return result.data;
  }

  /**
   * Execute the AI call against a specific model.
   */
  private async callModel(
    model: string,
    systemPrompt: string,
    task: AiTask,
  ): Promise<string> {
    const config =
      task === "generation"
        ? {
            maxTokens: AI_GENERATION_CONFIG.maxTokens,
            temperature: AI_GENERATION_CONFIG.temperature,
          }
        : {
            maxTokens: task === "classification" ? 150 : AI_CONFIG.maxTokens,
            temperature: task === "classification" ? 0 : AI_CONFIG.temperature,
          };

    try {
      const response = await this.client.chat.completions.create({
        model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content:
              task === "extraction"
                ? "Extraé las entidades del documento."
                : task === "classification"
                  ? "Clasificá el span proporcionado."
                  : "Generá el documento legal según las instrucciones.",
          },
        ],
      });

      return response.choices[0]?.message?.content ?? "";
    } catch (error) {
      if (error instanceof OpenRouterError) {
        throw error;
      }

      if (error instanceof SyntaxError) {
        this.logger.error(
          `Unprotected JSON.parse failed: ${error.message}`,
        );
        throw new OpenRouterError(
          `Invalid JSON response: ${error.message}`,
          "INVALID_RESPONSE",
        );
      }

      const status = (error as { status?: number })?.status ?? 0;
      const body = (error as { body?: unknown }).body;

      if (status === 401) {
        throw new OpenRouterError("Invalid OPENROUTER_API_KEY", "AUTH_ERROR", status, body);
      }

      if (status === 404) {
        throw new OpenRouterError(
          `Model not found: ${model}`,
          "MODEL_NOT_FOUND",
          status,
          body,
        );
      }

      if (status === 429) {
        throw new OpenRouterError("Rate limit exceeded", "RATE_LIMIT", status, body);
      }

      if (status > 0) {
        throw new OpenRouterError(
          `OpenRouter API error: ${error instanceof Error ? error.message : String(error)}`,
          "API_ERROR",
          status,
          body,
        );
      }

      throw new OpenRouterError(
        `OpenRouter API unreachable: ${error instanceof Error ? error.message : String(error)}`,
        "NETWORK_ERROR",
        status,
        body,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Document generation
  // -------------------------------------------------------------------------

  /**
   * Generate a legal document from template entities, user form data, and
   * optional base extracted text. Returns the generated text string.
   */
  async generateDocument(
    task: "generation" | "generation-no-base",
    vars: Record<string, string>,
  ): Promise<{ generatedText: string }> {
    try {
      const systemPrompt = await this.promptEngine.renderWithSafety(task, vars);

      const rawResponse = await this.callWithRetryChain("generation", systemPrompt);

      let parsed: unknown;
      try {
        parsed = JSON.parse(this.stripMarkdownFences(rawResponse));
      } catch (parseError) {
        this.logger.error(
          `Invalid JSON from generation: ${(parseError as Error).message}`,
        );
        throw new OpenRouterError(
          `Invalid JSON response from generation: ${(parseError as Error).message}`,
          "INVALID_RESPONSE",
        );
      }

      const obj = parsed as Record<string, unknown>;
      const generatedText = obj.generatedText;

      if (typeof generatedText !== "string" || generatedText.length === 0) {
        throw new OpenRouterError(
          "Generated text is empty or not a string",
          "INVALID_RESPONSE",
        );
      }

      return { generatedText };
    } catch (error) {
      if (error instanceof OpenRouterError) {
        const status = error.status ?? 0;
        const bodyFragment = (
          JSON.stringify(error.body) ?? "undefined"
        ).slice(0, 200);
        this.logger.error(
          `OpenRouter API error: status=${status}, body=${bodyFragment}`,
        );
        throw error;
      }

      if (error instanceof SyntaxError) {
        this.logger.error(
          `Invalid JSON response: ${error.message}`,
        );
        throw new OpenRouterError(
          `Invalid JSON response: ${error.message}`,
          "INVALID_RESPONSE",
        );
      }

      const status = (error as { status?: number })?.status ?? 0;
      const body = (error as { body?: unknown }).body;
      const bodyFragment = (JSON.stringify(body) ?? "undefined").slice(0, 200);
      this.logger.error(
        `OpenRouter API error: status=${status}, body=${bodyFragment}`,
      );

      if (status === 401) {
        throw new OpenRouterError("Invalid OPENROUTER_API_KEY", "AUTH_ERROR", status, body);
      }
      if (status === 404) {
        throw new OpenRouterError(`Model not found`, "MODEL_NOT_FOUND", status, body);
      }
      if (status === 429) {
        throw new OpenRouterError("Rate limit exceeded", "RATE_LIMIT", status, body);
      }
      if (status > 0) {
        throw new OpenRouterError(
          `OpenRouter API error: ${error instanceof Error ? error.message : String(error)}`,
          "API_ERROR",
          status,
          body,
        );
      }

      throw new OpenRouterError(
        `OpenRouter API unreachable: ${error instanceof Error ? error.message : String(error)}`,
        "NETWORK_ERROR",
        status,
        body,
      );
    }
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
