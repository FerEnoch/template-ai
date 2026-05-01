import "dotenv/config";
import { Pool } from "pg";
import { runMigrations } from "./migrate.ts";

type DbCheck = {
  description: string;
  sql: string;
  values?: unknown[];
};

const requiredMigration = "0001_domain_schema_first.sql";

function requiredDatabaseUrl(): string {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run db:migrate:validate");
  }

  return connectionString;
}

async function requireZeroRows(pool: Pool, query: string, description: string): Promise<void> {
  const result = await pool.query<{ total: string }>(query);
  const total = Number(result.rows[0]?.total ?? "0");

  if (total !== 0) {
    throw new Error(`${description}: expected clean DB, found ${total}`);
  }
}

async function assertExists(pool: Pool, check: DbCheck): Promise<void> {
  const result = await pool.query(check.sql, check.values ?? []);

  if (result.rowCount === 0) {
    throw new Error(`Missing required object: ${check.description}`);
  }
}

async function assertValidation(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString });

  try {
    await requireZeroRows(
      pool,
      "SELECT COUNT(*)::text AS total FROM information_schema.tables WHERE table_schema = 'public'",
      "public tables",
    );

    await runMigrations({ connectionString });

    const checks: DbCheck[] = [
      {
        description: "migration journal entry for 0001",
        sql: "SELECT 1 FROM schema_migrations WHERE version = $1",
        values: [requiredMigration],
      },
      {
        description: "extension btree_gist",
        sql: "SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'",
      },
      {
        description: "users table",
        sql: "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users'",
      },
      {
        description: "subscriptions table",
        sql: "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subscriptions'",
      },
      {
        description: "usage_ledger table",
        sql: "SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'usage_ledger'",
      },
      {
        description: "users_email_normalized_unique",
        sql: "SELECT 1 FROM pg_constraint WHERE conname = 'users_email_normalized_unique'",
      },
      {
        description: "users_external_subject_unique",
        sql: "SELECT 1 FROM pg_constraint WHERE conname = 'users_external_subject_unique'",
      },
      {
        description: "subscriptions_no_overlap exclusion constraint",
        sql: "SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_no_overlap'",
      },
      {
        description: "usage_ledger_units_fixed check",
        sql: "SELECT 1 FROM pg_constraint WHERE conname = 'usage_ledger_units_fixed'",
      },
      {
        description: "usage_ledger operation type check",
        sql: "SELECT 1 FROM pg_constraint WHERE conname = 'usage_ledger_operation_type_allowed'",
      },
      {
        description: "subscriptions_user_id_idx",
        sql: "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'subscriptions_user_id_idx'",
      },
      {
        description: "usage_ledger_user_id_idx",
        sql: "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'usage_ledger_user_id_idx'",
      },
      {
        description: "usage_ledger_subscription_id_idx",
        sql: "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'usage_ledger_subscription_id_idx'",
      },
      {
        description: "usage_ledger_user_created_at_idx",
        sql: "SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'usage_ledger_user_created_at_idx'",
      },
      {
        description: "users FORCE RLS",
        sql: "SELECT 1 FROM pg_class WHERE relname = 'users' AND relrowsecurity = true AND relforcerowsecurity = true",
      },
      {
        description: "subscriptions FORCE RLS",
        sql: "SELECT 1 FROM pg_class WHERE relname = 'subscriptions' AND relrowsecurity = true AND relforcerowsecurity = true",
      },
      {
        description: "usage_ledger FORCE RLS",
        sql: "SELECT 1 FROM pg_class WHERE relname = 'usage_ledger' AND relrowsecurity = true AND relforcerowsecurity = true",
      },
      {
        description: "usage_ledger append-only trigger",
        sql: "SELECT 1 FROM pg_trigger WHERE tgname = 'usage_ledger_append_only'",
      },
    ];

    for (const check of checks) {
      await assertExists(pool, check);
    }

    process.stdout.write("domain-schema-first migration validation passed\n");
  } finally {
    await pool.end();
  }
}

void assertValidation(requiredDatabaseUrl()).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
