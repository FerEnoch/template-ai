import { describe, expect, it } from "vitest";
import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const workspaceRoot = resolve(__dirname, "../../..");

async function pathExists(path: string) {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

describe("bootstrap boundaries", () => {
  it("keeps PostgreSQL bootstrap + approved migration slice only", async () => {
    await expect(
      pathExists(resolve(workspaceRoot, "apps/api/src/infrastructure/postgres/postgres.service.ts")),
    ).resolves.toBe(true);
    await expect(
      pathExists(resolve(workspaceRoot, "apps/api/src/infrastructure/postgres/migrate.ts")),
    ).resolves.toBe(true);
    await expect(
      pathExists(
        resolve(
          workspaceRoot,
          "apps/api/src/infrastructure/postgres/migrations/0001_domain_schema_first.sql",
        ),
      ),
    ).resolves.toBe(true);

    await expect(pathExists(resolve(workspaceRoot, "apps/api/src/repositories"))).resolves.toBe(false);
    await expect(pathExists(resolve(workspaceRoot, "apps/api/src/migrations"))).resolves.toBe(false);
    await expect(pathExists(resolve(workspaceRoot, "apps/api/src/seeds"))).resolves.toBe(false);
  });

  it("keeps migrations explicit and out of bootstrap startup", async () => {
    const mainSource = await readFile(resolve(workspaceRoot, "apps/api/src/main.ts"), "utf8");

    expect(mainSource).not.toContain("runMigrations");
    expect(mainSource).not.toContain("infrastructure/postgres/migrate");
  });

  it("keeps scope bootstrap-only without app container assets", async () => {
    await expect(pathExists(resolve(workspaceRoot, "apps/api/Dockerfile"))).resolves.toBe(false);
    await expect(pathExists(resolve(workspaceRoot, "apps/web/Dockerfile"))).resolves.toBe(false);
    await expect(pathExists(resolve(workspaceRoot, "apps/api/compose.yaml"))).resolves.toBe(false);
    await expect(pathExists(resolve(workspaceRoot, "apps/web/compose.yaml"))).resolves.toBe(false);
    await expect(pathExists(resolve(workspaceRoot, ".github/workflows"))).resolves.toBe(false);
    await expect(pathExists(resolve(workspaceRoot, "packages"))).resolves.toBe(false);
    await expect(pathExists(resolve(workspaceRoot, "apps/api/src/auth"))).resolves.toBe(false);
    await expect(pathExists(resolve(workspaceRoot, "apps/web/src/features"))).resolves.toBe(false);
  });

  it("keeps web root on bootstrap shell assets", async () => {
    const appEntries = (await readdir(resolve(workspaceRoot, "apps/web/src/app"))).sort();

    expect(appEntries).toEqual(["bootstrap-shell.spec.ts", "layout.tsx", "page.tsx"]);
  });

  it("keeps API root on bootstrap runtime assets", async () => {
    await expect(pathExists(resolve(workspaceRoot, "apps/api/src/config/env.ts"))).resolves.toBe(true);
    await expect(pathExists(resolve(workspaceRoot, "apps/api/src/health/health.controller.ts"))).resolves
      .toBe(true);
    await expect(
      pathExists(resolve(workspaceRoot, "apps/api/src/infrastructure/postgres/postgres.service.ts")),
    ).resolves.toBe(true);

    await expect(pathExists(resolve(workspaceRoot, "apps/api/src/auth"))).resolves.toBe(false);
  });

  it("keeps infra ownership guidance explicit in agents doc", async () => {
    const agentsDoc = await readFile(resolve(workspaceRoot, ".atl/agents.md"), "utf8");
    const infraDoc = await readFile(resolve(workspaceRoot, "docs/local-operational-infra.md"), "utf8");

    expect(agentsDoc).toContain("Makefile como interfaz SOLO para PostgreSQL/local infra");
    expect(agentsDoc).toContain("Comandos de apps (dev/start/lint/typecheck): `pnpm`");
    expect(infraDoc).toContain("`make`: PostgreSQL + Docker Compose lifecycle only.");
    expect(infraDoc).toContain("`pnpm`: workspace/app lifecycle commands.");
    expect(infraDoc).toContain("make smoke");
  });
});
