import { afterEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = ["PORT", "NODE_ENV", "DATABASE_URL", "OPENROUTER_API_KEY"] as const;
const BASE_ENV = {
  PORT: "3001",
  NODE_ENV: "test",
  DATABASE_URL: "postgres://template_ai_dev:template_ai_dev@localhost:5432/template_ai_dev",
  OPENROUTER_API_KEY: "sk-or-test-key-123",
} as const;

const originalEnv = { ...process.env };

async function loadGetApiEnv() {
  const mod = await import("./env.js");
  return mod.getApiEnv;
}

function setEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}) {
  process.env = { ...originalEnv };

  for (const key of ENV_KEYS) {
    delete process.env[key];
  }

  for (const key of ENV_KEYS) {
    const override = overrides[key];

    if (override !== undefined) {
      process.env[key] = override;
      continue;
    }

    process.env[key] = BASE_ENV[key];
  }

  vi.resetModules();
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe("getApiEnv", () => {
  it("returns parsed env when values are valid", async () => {
    setEnv();

    const getApiEnv = await loadGetApiEnv();

    const env = getApiEnv();

    expect(env).toEqual({
      PORT: 3001,
      NODE_ENV: "test",
      DATABASE_URL: BASE_ENV.DATABASE_URL,
      CORS_ORIGIN: "http://localhost:3000",
      OPENROUTER_API_KEY: "sk-or-test-key-123",
    });
  });

  it("fails fast when DATABASE_URL is invalid", async () => {
    setEnv({ DATABASE_URL: "not-a-url" });

    const getApiEnv = await loadGetApiEnv();

    expect(() => getApiEnv()).toThrowError("[api env] DATABASE_URL must be a valid URL");
  });

  it("fails fast when DATABASE_URL is missing", async () => {
    setEnv({ DATABASE_URL: undefined });
    delete process.env.DATABASE_URL;

    const getApiEnv = await loadGetApiEnv();

    expect(() => getApiEnv()).toThrowError("[api env] DATABASE_URL is required");
  });

  it("defaults CORS_ORIGIN to http://localhost:3000 when not set", async () => {
    setEnv();
    delete process.env.CORS_ORIGIN;

    const getApiEnv = await loadGetApiEnv();

    const env = getApiEnv();
    expect(env.CORS_ORIGIN).toBe("http://localhost:3000");
  });

  it("uses explicit CORS_ORIGIN when provided", async () => {
    setEnv();
    process.env.CORS_ORIGIN = "https://example.com";

    const getApiEnv = await loadGetApiEnv();

    const env = getApiEnv();
    expect(env.CORS_ORIGIN).toBe("https://example.com");
  });

  it("fails fast when OPENROUTER_API_KEY is missing", async () => {
    setEnv({ OPENROUTER_API_KEY: undefined });
    delete process.env.OPENROUTER_API_KEY;

    const getApiEnv = await loadGetApiEnv();

    expect(() => getApiEnv()).toThrowError("[api env] OPENROUTER_API_KEY is required");
  });
});
