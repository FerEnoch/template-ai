import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "@nestjs/common";

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv };
  process.env.PORT = "3001";
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = "postgres://template_ai_dev:template_ai_dev@localhost:5432/template_ai_dev";
  process.env.OPENROUTER_API_KEY = "sk-or-test-key-123";
  process.env.REDIS_HOST = "localhost";
  process.env.REDIS_PORT = "6379";
  process.env.AI_MODEL = "openai/gpt-4o-mini";
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

  it("has expected temperature default", async () => {
    const { AI_CONFIG } = await import("./ai.js");

    expect(AI_CONFIG.temperature).toBe(0.1);
  });

  it("defaults maxTokens to 8192 when AI_MAX_TOKENS is not set", async () => {
    delete process.env.AI_MAX_TOKENS;

    const { AI_CONFIG } = await import("./ai.js");

    expect(AI_CONFIG.maxTokens).toBe(8192);
  });

  it("resolves maxTokens from AI_MAX_TOKENS env var", async () => {
    process.env.AI_MAX_TOKENS = "16384";

    const { AI_CONFIG } = await import("./ai.js");

    expect(AI_CONFIG.maxTokens).toBe(16384);
  });

  it("throws at import time when AI_MAX_TOKENS is below 8192", async () => {
    process.env.AI_MAX_TOKENS = "4096";

    await expect(import("./ai.js")).rejects.toThrow("8192");
  });

  it("throws at import time when AI_MAX_TOKENS is NaN", async () => {
    process.env.AI_MAX_TOKENS = "not-a-number";

    await expect(import("./ai.js")).rejects.toThrow("8192");
  });

  it("throws at import time when AI_MAX_TOKENS contains non-numeric suffix", async () => {
    process.env.AI_MAX_TOKENS = "8192abc";

    await expect(import("./ai.js")).rejects.toThrow("8192");
  });

  it("treats empty AI_MAX_TOKENS as unset (defaults to 8192)", async () => {
    process.env.AI_MAX_TOKENS = "";

    const { AI_CONFIG } = await import("./ai.js");

    expect(AI_CONFIG.maxTokens).toBe(8192);
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

describe("AI_CONFIG.router", () => {
  it("is null when AI_MODEL_ROUTER_ENABLED is not set", async () => {
    delete process.env.AI_MODEL_ROUTER_ENABLED;

    const { AI_CONFIG } = await import("./ai.js");

    expect(AI_CONFIG.router).toBeNull();
  });

  it("is null when AI_MODEL_ROUTER_ENABLED is false", async () => {
    process.env.AI_MODEL_ROUTER_ENABLED = "false";
    process.env.AI_MODEL_EXTRACTION = "openai/gpt-4o";

    const { AI_CONFIG } = await import("./ai.js");

    expect(AI_CONFIG.router).toBeNull();
  });

  it("exposes per-task models and fallback when router is enabled", async () => {
    process.env.AI_MODEL_ROUTER_ENABLED = "true";
    process.env.AI_MODEL_EXTRACTION = "openai/gpt-4o";
    process.env.AI_MODEL_CLASSIFICATION = "anthropic/claude-3-haiku";
    process.env.AI_MODEL_GENERATION = "google/gemma-4-31b-it:free";
    process.env.AI_MODEL_FALLBACK = "openai/gpt-4o-mini";

    const { AI_CONFIG } = await import("./ai.js");

    expect(AI_CONFIG.router).toEqual({
      extraction: "openai/gpt-4o",
      classification: "anthropic/claude-3-haiku",
      generation: "google/gemma-4-31b-it:free",
      fallback: "openai/gpt-4o-mini",
    });
  });

  it("leaves per-task values undefined when router enabled but vars unset", async () => {
    process.env.AI_MODEL_ROUTER_ENABLED = "true";
    delete process.env.AI_MODEL_EXTRACTION;
    delete process.env.AI_MODEL_CLASSIFICATION;
    delete process.env.AI_MODEL_GENERATION;
    delete process.env.AI_MODEL_FALLBACK;

    const warnSpy = vi
      .spyOn(Logger.prototype, "warn")
      .mockImplementation(() => undefined);

    const { AI_CONFIG } = await import("./ai.js");

    expect(AI_CONFIG.router).toEqual({
      extraction: undefined,
      classification: undefined,
      generation: undefined,
      fallback: undefined,
    });
    expect(warnSpy).toHaveBeenCalledTimes(3);

    warnSpy.mockRestore();
  });

  it("throws at import time when router enabled but AI_MODEL is missing", async () => {
    process.env.AI_MODEL_ROUTER_ENABLED = "true";
    delete process.env.AI_MODEL;

    await expect(import("./ai.js")).rejects.toThrow(
      "AI_MODEL_ROUTER_ENABLED=true requires AI_MODEL to be set",
    );
  });

  it("does not read router env vars when router is disabled", async () => {
    process.env.AI_MODEL_ROUTER_ENABLED = "false";
    process.env.AI_MODEL_EXTRACTION = "openai/gpt-4o";

    const { AI_CONFIG } = await import("./ai.js");

    expect(AI_CONFIG.router).toBeNull();
  });
});