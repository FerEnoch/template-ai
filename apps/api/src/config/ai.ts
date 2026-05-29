import { join } from "node:path";
import { getApiEnv } from "./env.js";

const env = getApiEnv();

export const AI_CONFIG = {
  model: process.env.AI_MODEL ?? "google/gemini-2.5-flash:free",
  apiKey: env.OPENROUTER_API_KEY,
  maxTokens: 4096,
  temperature: 0.1,
} as const;

export const UPLOAD_DIR = process.env.UPLOAD_DIR ?? join(process.cwd(), "uploads");

// Ensure upload directory exists at import time
import { mkdirSync } from "node:fs";
mkdirSync(UPLOAD_DIR, { recursive: true });