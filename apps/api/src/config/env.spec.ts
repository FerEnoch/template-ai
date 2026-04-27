import { afterEach, describe, expect, it, vi } from "vitest";

const ENV_KEYS = ["PORT", "NODE_ENV", "DATABASE_URL"] as const;
const BASE_ENV = {
  PORT: "3001",
  NODE_ENV: "test",
  DATABASE_URL: "postgres://template_ai_dev:template_ai_dev@localhost:5432/template_ai_dev",
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
});
