import { join } from "node:path";
import { getApiEnv } from "./env.js";

const env = getApiEnv();

// ---------------------------------------------------------------------------
// Token budget: prevent JSON truncation on large documents.
// Default 8192 — gives headroom for system prompt (~2000 chars Spanish),
// few-shot examples (~600 chars), document text (thousands of chars),
// and the AI response JSON (entity array). Override via AI_MAX_TOKENS.
// ---------------------------------------------------------------------------
const maxTokensRaw = process.env.AI_MAX_TOKENS?.trim();
const maxTokensEnv = maxTokensRaw !== undefined && maxTokensRaw !== ""
  ? Number(maxTokensRaw)
  : 8192;

if (!Number.isInteger(maxTokensEnv) || maxTokensEnv < 8192) {
  throw new Error(
    `AI_MAX_TOKENS must be at least 8192 (got: ${process.env.AI_MAX_TOKENS ?? "unset"}). ` +
      `Lower values risk JSON truncation on large documents.`,
  );
}

export const AI_CONFIG = {
  model: process.env.AI_MODEL,
  modelFallback: process.env.AI_MODEL_FALLBACK,
  apiKey: env.OPENROUTER_API_KEY,
  maxTokens: maxTokensEnv,
  temperature: 0.1,
} as const;

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");

// Ensure upload directory exists at import time
import { mkdirSync } from "node:fs";
mkdirSync(UPLOAD_DIR, { recursive: true });