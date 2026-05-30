import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
  process.env.PORT = "3001";
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgres://template_ai_dev:template_ai_dev@localhost:5432/template_ai_dev";
  process.env.OPENROUTER_API_KEY = "sk-or-test-key-123";
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("AI_CONFIG", () => {
  it("resolves model from AI_MODEL env var", async () => {
    process.env.AI_MODEL = "openai/gpt-4o";

    const { AI_CONFIG } = await import("./ai.js");

    expect(AI_CONFIG.model).toBe("openai/gpt-4o");
  });

  it("is undefined when AI_MODEL is not set (no hardcoded fallback)", async () => {
    delete process.env.AI_MODEL;

    const { AI_CONFIG } = await import("./ai.js");

    expect(AI_CONFIG.model).toBeUndefined();
  });

  it("resolves modelFallback from AI_MODEL_FALLBACK env var", async () => {
    process.env.AI_MODEL_FALLBACK = "google/gemma-4-31b-it:free";

    const { AI_CONFIG } = await import("./ai.js");

    expect(AI_CONFIG.modelFallback).toBe("google/gemma-4-31b-it:free");
  });

  it("is undefined when AI_MODEL_FALLBACK is not set (no hardcoded fallback)", async () => {
    delete process.env.AI_MODEL_FALLBACK;

    const { AI_CONFIG } = await import("./ai.js");

    expect(AI_CONFIG.modelFallback).toBeUndefined();
  });

  it("exposes apiKey from OPENROUTER_API_KEY", async () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test-key-456";

    const { AI_CONFIG } = await import("./ai.js");

    expect(AI_CONFIG.apiKey).toBe("sk-or-test-key-456");
  });

  it("has expected maxTokens and temperature defaults", async () => {
    const { AI_CONFIG } = await import("./ai.js");

    expect(AI_CONFIG.maxTokens).toBe(4096);
    expect(AI_CONFIG.temperature).toBe(0.1);
  });
});

describe("UPLOAD_DIR", () => {
  it("defaults to cwd/uploads when UPLOAD_DIR is not set", async () => {
    delete process.env.UPLOAD_DIR;

    const { UPLOAD_DIR } = await import("./ai.js");

    expect(UPLOAD_DIR).toContain("uploads");
  });

  it("uses UPLOAD_DIR env var when provided", async () => {
    process.env.UPLOAD_DIR = "/tmp/test-uploads";

    const { UPLOAD_DIR } = await import("./ai.js");

    expect(UPLOAD_DIR).toBe("/tmp/test-uploads");
  });
});