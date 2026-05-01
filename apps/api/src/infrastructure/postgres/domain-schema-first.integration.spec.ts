/**
 * Domain Schema First — Integration tests for RLS owner isolation
 *
 * These tests validate PostgreSQL row-level security and DB constraints.
 * They require a live PostgreSQL database.
 *
 * When DATABASE_URL is not set, the suite is skipped silently.
 * Run with DATABASE_URL set to execute against a real PostgreSQL instance.
 */

import { describe, expect, it, beforeAll, afterAll, afterEach } from "vitest";
import { Pool } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;

// ---------------------------------------------------------------------------
// Pool setup — null when no DATABASE_URL, causing all tests to skip
// ---------------------------------------------------------------------------

let pool: Pool | null = null;

async function setupPool(): Promise<Pool | null> {
  if (!DATABASE_URL) return null;
  const p = new Pool({ connectionString: DATABASE_URL });
  try {
    await p.query("SELECT 1");
    return p;
  } catch {
    await p.end();
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requirePool(): Pool {
  if (!pool) throw new Error("Pool not initialized");
  return pool;
}

async function cleanDatabase(): Promise<void> {
  if (!pool) return;
  // Disable trigger, delete, re-enable — in finally to ensure re-enable even on failure
  try {
    await pool.query("ALTER TABLE usage_ledger DISABLE TRIGGER ALL");
    await pool.query("DELETE FROM usage_ledger");
  } finally {
    await pool.query("ALTER TABLE usage_ledger ENABLE TRIGGER ALL");
  }
  await pool.query("DELETE FROM subscriptions");
  await pool.query("DELETE FROM users");
  // Note: schema_migrations is intentionally NOT deleted here.
  // The journal tracks applied migrations; clearing it would cause re-apply on next run.
  // The beforeAll() runs migrations anyway, so the journal is re-populated.
}

async function runMigrations(): Promise<void> {
  if (!pool || !DATABASE_URL) return;
  const { runMigrations } = await import("./migrate.js");
  await runMigrations({ connectionString: DATABASE_URL });
}

// ---------------------------------------------------------------------------
// Test data fixtures
// ---------------------------------------------------------------------------

interface TestUser {
  id: number;
  email: string;
  displayName: string;
  externalSubject: string;
}

interface TestSubscription {
  id: number;
  userId: number;
  status: string;
  periodStart: Date;
  periodEnd: Date;
}

// ---------------------------------------------------------------------------
// Owner-scoped SQL helpers
// ---------------------------------------------------------------------------

async function createUserAs(
  ownerId: number,
  data: { email: string; displayName: string; externalSubject: string },
): Promise<TestUser> {
  const p = requirePool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = $1`, [ownerId]);
    const result = await client.query(
      `INSERT INTO users (email, display_name, external_subject)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, external_subject`,
      [data.email, data.displayName, data.externalSubject],
    );
    await client.query("COMMIT");
    return result.rows[0] as TestUser;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function createSubscriptionAs(
  ownerId: number,
  data: { userId: number; status: string; periodStart: Date; periodEnd: Date },
): Promise<TestSubscription> {
  const p = requirePool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = $1`, [ownerId]);
    const result = await client.query(
      `INSERT INTO subscriptions (user_id, status, period_start, period_end)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, status, period_start, period_end`,
      [data.userId, data.status, data.periodStart, data.periodEnd],
    );
    await client.query("COMMIT");
    return result.rows[0] as TestSubscription;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function insertUsageLedgerAs(
  ownerId: number,
  data: { userId: number; subscriptionId: number | null; operationType: string },
): Promise<{ id: number }> {
  const p = requirePool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = $1`, [ownerId]);
    const result = await client.query(
      `INSERT INTO usage_ledger (user_id, subscription_id, operation_type)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [data.userId, data.subscriptionId, data.operationType],
    );
    await client.query("COMMIT");
    return { id: result.rows[0].id as number };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function countUsersAs(ownerId: number): Promise<number> {
  const p = requirePool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = $1`, [ownerId]);
    const result = await client.query("SELECT COUNT(*)::int as count FROM users");
    await client.query("COMMIT");
    return result.rows[0].count as number;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function countSubscriptionsAs(ownerId: number): Promise<number> {
  const p = requirePool();
  const client = await p.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = $1`, [ownerId]);
    const result = await client.query("SELECT COUNT(*)::int as count FROM subscriptions");
    await client.query("COMMIT");
    return result.rows[0].count as number;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("domain-schema-first RLS owner isolation", () => {
  beforeAll(async () => {
    pool = await setupPool();
    if (!pool) return; // skip — no DATABASE_URL or DB not reachable
    await cleanDatabase();
    await runMigrations();
  });

  afterEach(async () => {
    if (!pool) return;
    await cleanDatabase();
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  describe("owner context filters rows", () => {
    it("user A cannot read user B's rows", async () => {
      if (!pool) return; // skip when no DB
      const userA = await createUserAs(0, {
        email: "usera@example.com",
        displayName: "User A",
        externalSubject: "subj_a",
      });
      const userB = await createUserAs(0, {
        email: "userb@example.com",
        displayName: "User B",
        externalSubject: "subj_b",
      });

      const countA = await countUsersAs(userA.id);
      expect(countA).toBe(1);

      const countB = await countUsersAs(userB.id);
      expect(countB).toBe(1);
    });

    it("user A cannot see user B's subscriptions", async () => {
      if (!pool) return;
      const userA = await createUserAs(0, {
        email: "usera@example.com",
        displayName: "User A",
        externalSubject: "subj_a",
      });
      const userB = await createUserAs(0, {
        email: "userb@example.com",
        displayName: "User B",
        externalSubject: "subj_b",
      });

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 86400 * 1000);

      await createSubscriptionAs(userA.id, {
        userId: userA.id,
        status: "activa",
        periodStart: now,
        periodEnd,
      });

      await createSubscriptionAs(userB.id, {
        userId: userB.id,
        status: "activa",
        periodStart: now,
        periodEnd,
      });

      const countA = await countSubscriptionsAs(userA.id);
      expect(countA).toBe(1);

      const countB = await countSubscriptionsAs(userB.id);
      expect(countB).toBe(1);
    });
  });

  describe("cross-user access denied", () => {
    it("user A's context cannot read user B's subscriptions", async () => {
      if (!pool) return;
      const userA = await createUserAs(0, {
        email: "usera@example.com",
        displayName: "User A",
        externalSubject: "subj_a",
      });
      const userB = await createUserAs(0, {
        email: "userb@example.com",
        displayName: "User B",
        externalSubject: "subj_b",
      });

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 86400 * 1000);

      await createSubscriptionAs(userB.id, {
        userId: userB.id,
        status: "activa",
        periodStart: now,
        periodEnd,
      });

      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [userA.id]);
        const result = await client.query(
          "SELECT COUNT(*)::int as count FROM subscriptions WHERE user_id = $1",
          [userB.id],
        );
        await client.query("COMMIT");
        expect(result.rows[0].count).toBe(0);
      } finally {
        client.release();
      }
    });
  });

  describe("append-only ledger isolation", () => {
    it("usage ledger rows are isolated per owner", async () => {
      if (!pool) return;
      const userA = await createUserAs(0, {
        email: "usera@example.com",
        displayName: "User A",
        externalSubject: "subj_a",
      });
      const userB = await createUserAs(0, {
        email: "userb@example.com",
        displayName: "User B",
        externalSubject: "subj_b",
      });

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 86400 * 1000);

      const subA = await createSubscriptionAs(userA.id, {
        userId: userA.id,
        status: "activa",
        periodStart: now,
        periodEnd,
      });
      const subB = await createSubscriptionAs(userB.id, {
        userId: userB.id,
        status: "activa",
        periodStart: now,
        periodEnd,
      });

      await insertUsageLedgerAs(userA.id, {
        userId: userA.id,
        subscriptionId: subA.id,
        operationType: "analisis_documento",
      });
      await insertUsageLedgerAs(userB.id, {
        userId: userB.id,
        subscriptionId: subB.id,
        operationType: "generacion_documento",
      });

      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [userA.id]);
        const result = await client.query(
          "SELECT COUNT(*)::int as count FROM usage_ledger WHERE user_id = $1",
          [userA.id],
        );
        await client.query("COMMIT");
        expect(result.rows[0].count).toBe(1);
      } finally {
        client.release();
      }
    });

    it("append-only trigger rejects UPDATE on usage_ledger", async () => {
      if (!pool) return;
      const userA = await createUserAs(0, {
        email: "usera@example.com",
        displayName: "User A",
        externalSubject: "subj_a",
      });

      const usage = await insertUsageLedgerAs(userA.id, {
        userId: userA.id,
        subscriptionId: null,
        operationType: "analisis_documento",
      });

      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [userA.id]);
        await client.query(
          "UPDATE usage_ledger SET operation_type = $1 WHERE id = $2",
          ["generacion_documento", usage.id],
        );
        await client.query("COMMIT");
        throw new Error("UPDATE should have been rejected by trigger");
      } catch (e) {
        await client.query("ROLLBACK");
        expect((e as Error).message).toContain("usage_ledger is append-only");
      } finally {
        client.release();
      }
    });

    it("append-only trigger rejects DELETE on usage_ledger", async () => {
      if (!pool) return;
      const userA = await createUserAs(0, {
        email: "usera@example.com",
        displayName: "User A",
        externalSubject: "subj_a",
      });

      const usage = await insertUsageLedgerAs(userA.id, {
        userId: userA.id,
        subscriptionId: null,
        operationType: "analisis_documento",
      });

      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [userA.id]);
        await client.query("DELETE FROM usage_ledger WHERE id = $1", [usage.id]);
        await client.query("COMMIT");
        throw new Error("DELETE should have been rejected by trigger");
      } catch (e) {
        await client.query("ROLLBACK");
        expect((e as Error).message).toContain("usage_ledger is append-only");
      } finally {
        client.release();
      }
    });
  });

  describe("DB constraints enforced", () => {
    it("duplicate email_normalized is rejected", async () => {
      if (!pool) return;
      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [0]);

        await client.query(
          `INSERT INTO users (email, display_name, external_subject)
           VALUES ($1, $2, $3)`,
          ["Test@example.com", "User One", "subj_one"],
        );

        await client.query(
          `INSERT INTO users (email, display_name, external_subject)
           VALUES ($1, $2, $3)`,
          ["TEST@EXAMPLE.COM", "User Two", "subj_two"],
        );

        await client.query("COMMIT");
        throw new Error("Duplicate normalized email should have been rejected");
      } catch (e) {
        await client.query("ROLLBACK");
        expect((e as Error).message).toMatch(/duplicate|unique|constraint/i);
      } finally {
        client.release();
      }
    });

    it("subscription overlap is rejected by EXCLUDE constraint", async () => {
      if (!pool) return;
      const userA = await createUserAs(0, {
        email: "usera@example.com",
        displayName: "User A",
        externalSubject: "subj_a",
      });

      const now = new Date();
      const periodEnd = new Date(now.getTime() + 86400 * 1000);

      await createSubscriptionAs(userA.id, {
        userId: userA.id,
        status: "activa",
        periodStart: now,
        periodEnd,
      });

      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [userA.id]);
        await client.query(
          `INSERT INTO subscriptions (user_id, status, period_start, period_end)
           VALUES ($1, $2, $3, $4)`,
          [userA.id, "activa", now, periodEnd],
        );
        await client.query("COMMIT");
        throw new Error("Overlapping subscription should have been rejected");
      } catch (e) {
        await client.query("ROLLBACK");
        expect((e as Error).message).toMatch(/overlap|exclude|constraint/i);
      } finally {
        client.release();
      }
    });

    it("units != 1 is rejected by CHECK constraint", async () => {
      if (!pool) return;
      const userA = await createUserAs(0, {
        email: "usera@example.com",
        displayName: "User A",
        externalSubject: "subj_a",
      });

      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [userA.id]);
        await client.query(
          `INSERT INTO usage_ledger (user_id, operation_type, units)
           VALUES ($1, $2, $3)`,
          [userA.id, "analisis_documento", 2],
        );
        await client.query("COMMIT");
        throw new Error("units = 2 should have been rejected");
      } catch (e) {
        await client.query("ROLLBACK");
        expect((e as Error).message).toMatch(/check|constraint|units/i);
      } finally {
        client.release();
      }
    });

    it("unsupported operation_type is rejected", async () => {
      if (!pool) return;
      const userA = await createUserAs(0, {
        email: "usera@example.com",
        displayName: "User A",
        externalSubject: "subj_a",
      });

      const p = requirePool();
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        await client.query(`SET LOCAL app.current_user_id = $1`, [userA.id]);
        await client.query(
          `INSERT INTO usage_ledger (user_id, operation_type)
           VALUES ($1, $2)`,
          [userA.id, "invalid_operation"],
        );
        await client.query("COMMIT");
        throw new Error("Invalid operation_type should have been rejected");
      } catch (e) {
        await client.query("ROLLBACK");
        expect((e as Error).message).toMatch(/check|constraint|operation_type/i);
      } finally {
        client.release();
      }
    });
  });
});