import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { metadata } from "./layout";
import RootLayout from "./layout";
import Page from "./page";

const webRoot = resolve(__dirname, "../..");
const workspaceRoot = resolve(__dirname, "../../../..");

function renderNode(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (!node || typeof node !== "object") {
    return "";
  }

  const element = node as {
    props?: {
      children?: unknown;
      lang?: string;
    };
  };

  const children = element.props?.children;

  if (Array.isArray(children)) {
    return children.map(renderNode).join("");
  }

  return renderNode(children);
}

describe("web bootstrap shell", () => {
  it("exposes Spanish metadata", () => {
    expect(metadata.title).toBe("Template AI");
    expect(metadata.description).toBe("Bootstrap técnico de la aplicación web");
  });

  it("renders html with lang es boundary", () => {
    const layout = RootLayout({ children: "contenido" });

    expect(layout.props.lang).toBe("es");
    expect(renderNode(layout)).toContain("contenido");
  });

  it("renders a neutral Spanish shell page", () => {
    const page = Page();

    expect(renderNode(page)).toContain("Template AI");
    expect(renderNode(page)).toContain("Shell inicial del frontend listo para conectar capacidades futuras.");
  });

  it("documents only NEXT_PUBLIC vars in web env example", async () => {
    const envFile = await readFile(resolve(webRoot, ".env.example"), "utf8");

    const lines = envFile
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"));

    expect(lines.length).toBeGreaterThan(0);

    for (const line of lines) {
      const key = line.split("=")[0];
      expect(key.startsWith("NEXT_PUBLIC_")).toBe(true);
    }
  });

  it("keeps server-only vars out of web env example", async () => {
    const apiEnvFile = await readFile(resolve(workspaceRoot, "apps/api/.env.example"), "utf8");

    expect(apiEnvFile).toContain("DATABASE_URL=");
    expect(apiEnvFile).not.toContain("NEXT_PUBLIC_");
  });
});
