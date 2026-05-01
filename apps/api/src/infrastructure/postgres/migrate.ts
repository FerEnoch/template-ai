import "dotenv/config";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pool } from "pg";

// Default migrations dir — resolve at runtime from cwd to avoid import.meta in CommonJS context
const DEFAULT_MIGRATIONS_DIR = join(process.cwd(), "src/infrastructure/postgres/migrations");
const JOURNAL_TABLE = "schema_migrations";

type RunMigrationsOptions = {
  connectionString: string;
  migrationsDir?: string;
};

function requiredDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run db:migrate");
  }

  return connectionString;
}

function sqlChecksum(sql: string): string {
  return createHash("sha256").update(sql).digest("hex");
}

async function ensureJournal(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${JOURNAL_TABLE} (
      version TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function readMigrationFiles(migrationsDir: string): Promise<string[]> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((entry) => /^\d+.*\.sql$/.test(entry))
    .sort();
}

async function readAppliedMigrations(pool: Pool): Promise<Map<string, string>> {
  const result = await pool.query<{ version: string; checksum: string }>(
    `SELECT version, checksum FROM ${JOURNAL_TABLE}`,
  );

  return new Map(result.rows.map((row) => [row.version, row.checksum]));
}

export async function runMigrations({
  connectionString,
  migrationsDir = DEFAULT_MIGRATIONS_DIR,
}: RunMigrationsOptions): Promise<void> {
  const pool = new Pool({ connectionString });

  try {
    await ensureJournal(pool);
    const migrationFiles = await readMigrationFiles(migrationsDir);
    const appliedMigrations = await readAppliedMigrations(pool);

    for (const fileName of migrationFiles) {
      const filePath = join(migrationsDir, fileName);
      const migrationSql = await readFile(filePath, "utf8");
      const checksum = sqlChecksum(migrationSql);
      const currentChecksum = appliedMigrations.get(fileName);

      if (currentChecksum) {
        if (currentChecksum !== checksum) {
          throw new Error(`Migration checksum mismatch for ${fileName}`);
        }

        continue;
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");
        await client.query(migrationSql);
        await client.query(
          `INSERT INTO ${JOURNAL_TABLE} (version, checksum) VALUES ($1, $2)`,
          [fileName, checksum],
        );
        await client.query("COMMIT");
        process.stdout.write(`Applied migration ${fileName}\n`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

async function main() {
  await runMigrations({ connectionString: requiredDatabaseUrl() });
}

const isDirectExecution = process.argv[1]
  ? process.argv[1].endsWith("migrate.ts")
  : false;

if (isDirectExecution) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
