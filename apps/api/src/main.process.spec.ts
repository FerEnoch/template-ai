import { afterEach, describe, expect, it } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";

const workspaceRoot = resolve(__dirname, "../../..");
const originalEnv = { ...process.env };

function randomPort() {
  return 38000 + Math.floor(Math.random() * 2000);
}

function createApiProcess(env: NodeJS.ProcessEnv): ChildProcess {
  return spawn("pnpm", ["--filter", "@template-ai/api", "exec", "nest", "start"], {
    cwd: workspaceRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

async function waitForHttp(url: string, timeoutMs: number): Promise<Response> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      return response;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  throw new Error(`Timed out waiting for HTTP endpoint: ${url}`);
}

async function waitForExit(child: ChildProcess, timeoutMs: number): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Timed out waiting process exit"));
    }, timeoutMs);

    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("API bootstrap process contract", () => {
  it("starts from valid env on configured port and keeps /health live while /ready is not ready", async () => {
    const port = randomPort();
    const child = createApiProcess({
      ...originalEnv,
      PORT: String(port),
      NODE_ENV: "test",
      DATABASE_URL:
        "postgres://template_ai_dev:template_ai_dev@127.0.0.1:1/template_ai_dev?connect_timeout=1",
    });

    try {
      const health = await waitForHttp(`http://127.0.0.1:${port}/health`, 25_000);
      const ready = await fetch(`http://127.0.0.1:${port}/ready`);

      expect(health.status).toBe(200);
      await expect(health.json()).resolves.toEqual({ status: "ok" });

      expect(ready.status).toBe(503);
      await expect(ready.json()).resolves.toMatchObject({ status: "not_ready" });
    } finally {
      child.kill("SIGTERM");
      await waitForExit(child, 10_000).catch(() => undefined);
    }
  });

  it("rejects invalid env at process startup with non-zero exit", async () => {
    const port = randomPort();
    const child = createApiProcess({
      ...originalEnv,
      PORT: String(port),
      NODE_ENV: "test",
    });

    const exitCode = await waitForExit(child, 15_000);

    expect(exitCode).not.toBe(0);
  });
});
