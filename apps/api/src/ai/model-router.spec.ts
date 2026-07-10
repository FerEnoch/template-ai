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

async function importRouter() {
  const { resolveModel, resolveModelChain, validateRouterConfig } = await import(
    "./model-router.js"
  );
  return { resolveModel, resolveModelChain, validateRouterConfig };
}

async function importConfig() {
  const { AI_CONFIG } = await import("../config/ai.js");
  return { AI_CONFIG };
}

describe("ModelRouter", () => {
  describe("resolveModel", () => {
    it("returns AI_MODEL when router is disabled", async () => {
      delete process.env.AI_MODEL_ROUTER_ENABLED;
      const { resolveModel } = await importRouter();

      expect(resolveModel("extraction")).toBe("openai/gpt-4o-mini");
      expect(resolveModel("classification")).toBe("openai/gpt-4o-mini");
      expect(resolveModel("generation")).toBe("openai/gpt-4o-mini");
    });

    it("resolves per-task model when router is enabled", async () => {
      process.env.AI_MODEL_ROUTER_ENABLED = "true";
      process.env.AI_MODEL_EXTRACTION = "openai/gpt-4o";
      process.env.AI_MODEL_CLASSIFICATION = "anthropic/claude-3-haiku";
      process.env.AI_MODEL_GENERATION = "google/gemma-4-31b-it:free";
      const { resolveModel } = await importRouter();

      expect(resolveModel("extraction")).toBe("openai/gpt-4o");
      expect(resolveModel("classification")).toBe("anthropic/claude-3-haiku");
      expect(resolveModel("generation")).toBe("google/gemma-4-31b-it:free");
    });

    it("falls back to AI_MODEL_FALLBACK when per-task var is unset", async () => {
      process.env.AI_MODEL_ROUTER_ENABLED = "true";
      delete process.env.AI_MODEL_EXTRACTION;
      process.env.AI_MODEL_FALLBACK = "anthropic/claude-3-haiku";
      const { resolveModel } = await importRouter();

      expect(resolveModel("extraction")).toBe("anthropic/claude-3-haiku");
    });

    it("falls back to AI_MODEL when both per-task and FALLBACK are unset", async () => {
      process.env.AI_MODEL_ROUTER_ENABLED = "true";
      delete process.env.AI_MODEL_EXTRACTION;
      delete process.env.AI_MODEL_FALLBACK;
      const warnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      const { resolveModel } = await importRouter();

      expect(resolveModel("extraction")).toBe("openai/gpt-4o-mini");
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("AI_MODEL_EXTRACTION"));
      warnSpy.mockRestore();
    });

    it("ignores router vars when router is disabled", async () => {
      process.env.AI_MODEL_ROUTER_ENABLED = "false";
      process.env.AI_MODEL_EXTRACTION = "openai/gpt-4o";
      const { resolveModel } = await importRouter();

      expect(resolveModel("extraction")).toBe("openai/gpt-4o-mini");
    });
  });

  describe("resolveModelChain", () => {
    it("returns single AI_MODEL when router is disabled", async () => {
      delete process.env.AI_MODEL_ROUTER_ENABLED;
      const { resolveModelChain } = await importRouter();

      expect(resolveModelChain("extraction")).toEqual(["openai/gpt-4o-mini"]);
    });

    it("returns [perTask, AI_MODEL] when per-task is set and fallback is unset", async () => {
      process.env.AI_MODEL_ROUTER_ENABLED = "true";
      process.env.AI_MODEL_EXTRACTION = "openai/gpt-4o";
      delete process.env.AI_MODEL_FALLBACK;
      const { resolveModelChain } = await importRouter();

      expect(resolveModelChain("extraction")).toEqual(["openai/gpt-4o", "openai/gpt-4o-mini"]);
    });

    it("returns [perTask, FALLBACK] when both are set and different", async () => {
      process.env.AI_MODEL_ROUTER_ENABLED = "true";
      process.env.AI_MODEL_EXTRACTION = "openai/gpt-4o";
      process.env.AI_MODEL_FALLBACK = "anthropic/claude-3-haiku";
      const { resolveModelChain } = await importRouter();

      expect(resolveModelChain("extraction")).toEqual([
        "openai/gpt-4o",
        "anthropic/claude-3-haiku",
      ]);
    });

    it("deduplicates when per-task equals FALLBACK", async () => {
      process.env.AI_MODEL_ROUTER_ENABLED = "true";
      process.env.AI_MODEL_EXTRACTION = "openai/gpt-4o";
      process.env.AI_MODEL_FALLBACK = "openai/gpt-4o";
      const { resolveModelChain } = await importRouter();

      expect(resolveModelChain("extraction")).toEqual([
        "openai/gpt-4o",
        "openai/gpt-4o-mini",
      ]);
    });

    it("caps chain at 2 models", async () => {
      process.env.AI_MODEL_ROUTER_ENABLED = "true";
      process.env.AI_MODEL_EXTRACTION = "openai/gpt-4o";
      process.env.AI_MODEL_FALLBACK = "anthropic/claude-3-haiku";
      process.env.AI_MODEL = "google/gemma-4-31b-it:free";
      const { resolveModelChain } = await importRouter();

      const chain = resolveModelChain("extraction");
      expect(chain.length).toBeLessThanOrEqual(2);
      expect(chain).toEqual(["openai/gpt-4o", "anthropic/claude-3-haiku"]);
    });

    it("degrades to [AI_MODEL] when per-task and FALLBACK are unset", async () => {
      process.env.AI_MODEL_ROUTER_ENABLED = "true";
      delete process.env.AI_MODEL_EXTRACTION;
      delete process.env.AI_MODEL_FALLBACK;
      const { resolveModelChain } = await importRouter();

      expect(resolveModelChain("extraction")).toEqual(["openai/gpt-4o-mini"]);
    });

    it("resolves all three tasks with distinct chains", async () => {
      process.env.AI_MODEL_ROUTER_ENABLED = "true";
      process.env.AI_MODEL_EXTRACTION = "openai/gpt-4o";
      process.env.AI_MODEL_CLASSIFICATION = "anthropic/claude-3-haiku";
      process.env.AI_MODEL_GENERATION = "google/gemma-4-31b-it:free";
      process.env.AI_MODEL_FALLBACK = "openai/gpt-4o-mini";
      const { resolveModelChain } = await importRouter();

      expect(resolveModelChain("extraction")).toEqual(["openai/gpt-4o", "openai/gpt-4o-mini"]);
      expect(resolveModelChain("classification")).toEqual([
        "anthropic/claude-3-haiku",
        "openai/gpt-4o-mini",
      ]);
      expect(resolveModelChain("generation")).toEqual([
        "google/gemma-4-31b-it:free",
        "openai/gpt-4o-mini",
      ]);
    });
  });

  describe("validateRouterConfig", () => {
    it("throws when router enabled and AI_MODEL is missing", async () => {
      const config = {
        model: undefined,
        router: {
          extraction: "openai/gpt-4o",
          classification: undefined,
          generation: undefined,
          fallback: undefined,
        },
      };

      const { validateRouterConfig } = await importRouter();
      expect(() => validateRouterConfig(config as any)).toThrow(
        "AI_MODEL_ROUTER_ENABLED=true requires AI_MODEL to be set",
      );
    });

    it("warns for each missing per-task var when router enabled", async () => {
      const warnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      const config = {
        model: "openai/gpt-4o-mini",
        router: {
          extraction: undefined,
          classification: undefined,
          generation: undefined,
          fallback: undefined,
        },
      };

      const { validateRouterConfig } = await importRouter();
      validateRouterConfig(config as any);

      expect(warnSpy).toHaveBeenCalledTimes(3);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("AI_MODEL_EXTRACTION"));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("AI_MODEL_CLASSIFICATION"));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("AI_MODEL_GENERATION"));
      warnSpy.mockRestore();
    });

    it("does nothing when router is disabled", async () => {
      const warnSpy = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
      const config = {
        model: undefined,
        router: null,
      };

      const { validateRouterConfig } = await importRouter();
      validateRouterConfig(config as any);

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
