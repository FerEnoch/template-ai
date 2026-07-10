import { Logger } from "@nestjs/common";

// ---------------------------------------------------------------------------
// Model router: per-task model resolution with a universal fallback chain.
//
// Resolution is per-call (not cached) so environment changes take effect
// immediately. The chain is deduplicated and capped at two models:
//   [perTaskModel, AI_MODEL]            when no fallback is configured
//   [perTaskModel, AI_MODEL_FALLBACK]   when fallback is configured
//   [AI_MODEL]                          when router is disabled
// ---------------------------------------------------------------------------

export type AiTask = "extraction" | "classification" | "generation";

const TASK_ENV_VAR: Record<AiTask, string> = {
  extraction: "AI_MODEL_EXTRACTION",
  classification: "AI_MODEL_CLASSIFICATION",
  generation: "AI_MODEL_GENERATION",
};

const logger = new Logger("ModelRouter");

export interface RouterConfig {
  model?: string;
  router: {
    extraction?: string;
    classification?: string;
    generation?: string;
    fallback?: string;
  } | null;
}

function isRouterEnabled(): boolean {
  return process.env.AI_MODEL_ROUTER_ENABLED === "true";
}

function getBaseModel(): string {
  return process.env.AI_MODEL ?? "";
}

/**
 * Validates the router configuration at bootstrap.
 *
 * - Throws when the router is enabled but AI_MODEL is missing.
 * - Logs a WARNING for each missing per-task variable (non-fatal).
 * - Does nothing when the router is disabled.
 */
export function validateRouterConfig(config: RouterConfig): void {
  if (!config.router) {
    return;
  }

  if (!config.model || config.model.trim() === "") {
    throw new Error("AI_MODEL_ROUTER_ENABLED=true requires AI_MODEL to be set");
  }

  const tasks: AiTask[] = ["extraction", "classification", "generation"];
  for (const task of tasks) {
    if (!config.router[task] || config.router[task]!.trim() === "") {
      logger.warn(
        `AI_MODEL_ROUTER_ENABLED=true but ${TASK_ENV_VAR[task]} is not set; falling back to AI_MODEL`,
      );
    }
  }
}

/**
 * Resolves the single model to use for a task.
 *
 * Order: per-task env var → AI_MODEL_FALLBACK → AI_MODEL.
 */
export function resolveModel(task: AiTask): string {
  if (!isRouterEnabled()) {
    return getBaseModel();
  }

  const perTask = process.env[TASK_ENV_VAR[task]]?.trim();
  if (perTask) {
    return perTask;
  }

  const fallback = process.env.AI_MODEL_FALLBACK?.trim();
  if (fallback) {
    logger.warn(
      `${TASK_ENV_VAR[task]} not set; falling back to AI_MODEL_FALLBACK`,
    );
    return fallback;
  }

  logger.warn(
    `${TASK_ENV_VAR[task]} not set and AI_MODEL_FALLBACK not set; falling back to AI_MODEL`,
  );
  return getBaseModel();
}

/**
 * Resolves an ordered model chain for a task.
 *
 * The conceptual chain is [perTaskModel, AI_MODEL_FALLBACK, AI_MODEL].
 * The returned chain is deduplicated and capped at 2 entries, preferring
 * earlier models in the fallback order.
 */
export function resolveModelChain(task: AiTask): string[] {
  const base = getBaseModel();

  if (!isRouterEnabled()) {
    return [base];
  }

  const perTask = process.env[TASK_ENV_VAR[task]]?.trim();
  const fallback = process.env.AI_MODEL_FALLBACK?.trim();

  // Build the conceptual fallback chain in order, then deduplicate.
  const conceptual: string[] = [];
  if (perTask) conceptual.push(perTask);
  if (fallback) conceptual.push(fallback);
  conceptual.push(base);

  const chain = conceptual.filter((model, index) => conceptual.indexOf(model) === index);

  return chain.slice(0, 2);
}
