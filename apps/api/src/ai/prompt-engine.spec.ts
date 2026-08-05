import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import {
  PromptEngine,
  PromptRenderError,
  PromptTemplateNotFoundError,
} from "./prompt-engine.js";

describe("PromptEngine", () => {
  let tmpDir = "";
  let engine: PromptEngine;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "prompt-engine-"));
    engine = new PromptEngine(tmpDir);
  });

  async function writePrompt(relativePath: string, content: string) {
    const path = join(tmpDir, relativePath);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf8");
  }

  afterEach(async () => {
    if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
  });

  describe("load", () => {
    it("reads a template from disk on first call", async () => {
      await writeFile(join(tmpDir, "hello.md"), "Hello {{name}}", "utf8");

      const content = await engine.load("hello");

      expect(content).toBe("Hello {{name}}");
    });

    it("caches templates in memory after first load", async () => {
      const path = join(tmpDir, "cached.md");
      await writeFile(path, "v1", "utf8");
      await engine.load("cached");

      // Mutate file behind the cache to prove the second read is cached.
      await writeFile(path, "v2", "utf8");
      const content = await engine.load("cached");

      expect(content).toBe("v1");
    });

    it("throws PromptTemplateNotFoundError when the template file is missing", async () => {
      await expect(engine.load("missing")).rejects.toBeInstanceOf(
        PromptTemplateNotFoundError,
      );
    });

    it("resolves task aliases to subdirectory system.md files", async () => {
      await writePrompt("extraction/system.md", "Extract: {{text}}");

      const content = await engine.load("extraction");

      expect(content).toBe("Extract: {{text}}");
    });
  });

  describe("render", () => {
    it("interpolates {{variables}} from the vars object", () => {
      const result = engine.render("Hola {{name}}", { name: "Mundo" });

      expect(result).toBe("Hola Mundo");
    });

    it("replaces multiple occurrences of the same variable", () => {
      const result = engine.render("{{x}} {{x}}", { x: "dup" });

      expect(result).toBe("dup dup");
    });

    it("throws PromptRenderError when a referenced variable is missing", () => {
      expect(() => engine.render("{{missing}}", {})).toThrow(PromptRenderError);
      expect(() => engine.render("{{missing}}", {})).toThrow(/missing/);
    });

    it("does not interpolate variables not present in the template", () => {
      const result = engine.render("Hola", { unused: "x" });

      expect(result).toBe("Hola");
    });
  });

  describe("renderWithSafety", () => {
    it("prepends the safety preamble to the rendered task template", async () => {
      await writePrompt("_shared/safety.md", "SAFETY LINE\n");
      await writePrompt("extraction/system.md", "Extract {{text}}");

      const result = await engine.renderWithSafety("extraction", { text: "X" });

      expect(result.startsWith("SAFETY LINE")).toBe(true);
      expect(result).toContain("Extract X");
    });

    it("renders safety preamble variables when present", async () => {
      await writePrompt("_shared/safety.md", "Task: {{task}}");
      await writePrompt("classification/system.md", "Classify");

      const result = await engine.renderWithSafety("classification", { task: "classify" });

      expect(result).toContain("Task: classify");
    });

    it("throws PromptRenderError when task template references a missing variable", async () => {
      await writePrompt("_shared/safety.md", "Safety");
      await writePrompt("extraction/system.md", "Extract {{text}}");

      await expect(engine.renderWithSafety("extraction", {})).rejects.toBeInstanceOf(
        PromptRenderError,
      );
    });
  });
});
