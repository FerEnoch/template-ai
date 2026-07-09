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

// ---------------------------------------------------------------------------
// Document generation config: higher token budget and temperature for
// generating full legal documents from template entities + form data.
// Override via AI_GENERATION_MAX_TOKENS and AI_GENERATION_TEMPERATURE.
// ---------------------------------------------------------------------------
const genMaxTokensRaw = process.env.AI_GENERATION_MAX_TOKENS?.trim();
const genMaxTokens = genMaxTokensRaw !== undefined && genMaxTokensRaw !== ""
  ? Number(genMaxTokensRaw)
  : 16384;

const genTempRaw = process.env.AI_GENERATION_TEMPERATURE?.trim();
const genTemp = genTempRaw !== undefined && genTempRaw !== ""
  ? Number(genTempRaw)
  : 0.3;

export const AI_GENERATION_CONFIG = {
  maxTokens: genMaxTokens,
  temperature: genTemp,
} as const;

// ---------------------------------------------------------------------------
// Cache configuration: Redis-backed AI response and text extraction cache.
// AI_CACHE_ENABLED gates all cache operations (default: false).
// TTLs default to 7 days (604800s). Max entry size: 1MB.
// ---------------------------------------------------------------------------
const responseCacheTtlRaw = process.env.AI_RESPONSE_CACHE_TTL?.trim();
const responseCacheTtlEnv = responseCacheTtlRaw !== undefined && responseCacheTtlRaw !== ""
  ? Number(responseCacheTtlRaw)
  : 604800;

const textCacheTtlRaw = process.env.AI_TEXT_CACHE_TTL?.trim();
const textCacheTtlEnv = textCacheTtlRaw !== undefined && textCacheTtlRaw !== ""
  ? Number(textCacheTtlRaw)
  : 604800;

const cacheMaxBytesRaw = process.env.AI_CACHE_MAX_ENTRY_BYTES?.trim();
const cacheMaxBytesEnv = cacheMaxBytesRaw !== undefined && cacheMaxBytesRaw !== ""
  ? Number(cacheMaxBytesRaw)
  : 1048576;

export const CACHE_CONFIG = {
  enabled: env.AI_CACHE_ENABLED,
  responseCacheTtl: responseCacheTtlEnv,
  textCacheTtl: textCacheTtlEnv,
  maxEntryBytes: cacheMaxBytesEnv,
} as const;

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");

// Ensure upload directory exists at import time
import { mkdirSync } from "node:fs";
mkdirSync(UPLOAD_DIR, { recursive: true });