import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export class PromptTemplateNotFoundError extends Error {
  constructor(public readonly name: string) {
    super(`Prompt template not found: ${name}`);
    this.name = "PromptTemplateNotFoundError";
  }
}

export class PromptRenderError extends Error {
  constructor(public readonly variableName: string) {
    super(`Missing variable "${variableName}" during prompt render`);
    this.name = "PromptRenderError";
  }
}

const TASK_PATHS: Record<string, string> = {
  extraction: "extraction/system.md",
  classification: "classification/system.md",
  generation: "generation/with-base.md",
  "generation-no-base": "generation/no-base.md",
  verification: "generation/verification.md",
};

export class PromptEngine {
  private readonly cache = new Map<string, string>();
  private readonly promptsDir: string;

  constructor(promptsDir?: string) {
    this.promptsDir =
      promptsDir ??
      resolve(dirname(fileURLToPath(import.meta.url)), "prompts");
  }

  private resolvePath(name: string): string {
    const relative = TASK_PATHS[name] ?? `${name}.md`;
    return resolve(this.promptsDir, relative);
  }

  async load(name: string): Promise<string> {
    const cached = this.cache.get(name);
    if (cached !== undefined) {
      return cached;
    }

    const path = this.resolvePath(name);
    try {
      const content = await readFile(path, "utf8");
      this.cache.set(name, content);
      return content;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        throw new PromptTemplateNotFoundError(name);
      }
      throw error;
    }
  }

  render(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, variableName: string) => {
      if (!Object.prototype.hasOwnProperty.call(vars, variableName)) {
        throw new PromptRenderError(variableName);
      }
      return vars[variableName];
    });
  }

  async renderWithSafety(
    task: string,
    vars: Record<string, string>,
  ): Promise<string> {
    const [safety, taskTemplate] = await Promise.all([
      this.load("_shared/safety"),
      this.load(task),
    ]);

    const renderedSafety = this.render(safety, vars);
    const renderedTask = this.render(taskTemplate, vars);

    return `${renderedSafety}\n${renderedTask}`;
  }
}
