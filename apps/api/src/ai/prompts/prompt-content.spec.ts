import { describe, expect, it } from "vitest";
import { PromptEngine } from "../prompt-engine.js";

const engine = new PromptEngine();

describe("prompt content", () => {
  describe("_shared/safety.md", () => {
    it("contains the required safety rules", async () => {
      const content = await engine.load("_shared/safety");

      expect(content).toContain("No inventes información");
      expect(content).toContain("No infieras datos implícitos");
      expect(content).toContain("indicá confianza BAJA");
      expect(content).toContain("datos personales sensibles");
    });
  });

  describe("extraction/system.md", () => {
    it("contains extraction-specific instructions and variables", async () => {
      const content = await engine.load("extraction");

      expect(content).toContain("{{groups}}");
      expect(content).toContain("{{fewShot}}");
      expect(content).toContain("{{documentText}}");
      expect(content).toMatch(/razon[áa] paso a paso|paso a paso/i);
      expect(content).toContain("ALTA");
      expect(content).toContain("MEDIA");
      expect(content).toContain("BAJA");
      expect(content).toContain("No inventes");
      expect(content).toContain("sourceSpan");
      expect(content).toContain("entities");
    });
  });

  describe("classification/system.md", () => {
    it("contains classification variables and fallback groups", async () => {
      const content = await engine.load("classification");

      expect(content).toContain("{{groups}}");
      expect(content).toContain("{{span}}");
      expect(content).toContain("{{context}}");
      expect(content).toContain("GENERAL");
      expect(content).toContain("OTROS");
    });
  });

  describe("generation/with-base.md", () => {
    it("contains generation instructions with base text", async () => {
      const content = await engine.load("generation");

      expect(content).toContain("{{entities}}");
      expect(content).toContain("{{formData}}");
      expect(content).toContain("{{baseText}}");
      expect(content).toContain("[COMPLETAR]");
      expect(content).toMatch(/tono.*formal|derecho mexicano|es-MX/i);
      expect(content).toContain("formulario");
      expect(content).toContain("texto base");
      expect(content).toContain("generatedText");
    });
  });

  describe("generation/no-base.md", () => {
    it("contains generation instructions without base text", async () => {
      const content = await engine.load("generation-no-base");

      expect(content).toContain("{{entities}}");
      expect(content).toContain("{{formData}}");
      expect(content).not.toContain("{{baseText}}");
      expect(content).toContain("[COMPLETAR]");
      expect(content).toMatch(/tono.*formal|derecho mexicano|es-MX/i);
      expect(content).toContain("Cláusulas");
      expect(content).toContain("generatedText");
    });
  });

  describe("generation/verification.md", () => {
    it("contains verification instructions and output schema", async () => {
      const content = await engine.load("verification");

      expect(content).toContain("[COMPLETAR]");
      expect(content).toContain("passed");
      expect(content).toContain("completarCount");
      expect(content).toContain("warnings");
      expect(content).toMatch(/no bloquea|no bloquear/i);
    });
  });
});
