import { PoolClient } from "pg";

export type UsageOperation = "analisis_documento" | "generacion_documento";

export interface UsageLedgerRecord {
  id: number;
  userId: number;
  subscriptionId: number | null;
  operationType: UsageOperation;
  units: number;
  createdAt: Date;
}

export interface CreateUsageLedgerInput {
  userId: number;
  subscriptionId?: number | null;
  operationType: UsageOperation;
}

function rowToUsageLedger(row: Record<string, unknown>): UsageLedgerRecord {
  return {
    id: row["id"] as number,
    userId: row["user_id"] as number,
    subscriptionId: row["subscription_id"] as number | null,
    operationType: row["operation_type"] as UsageOperation,
    units: row["units"] as number,
    createdAt: row["created_at"] as Date,
  };
}

export class UsageLedgerRepository {
  constructor(private readonly client: PoolClient) {}

  async append(input: CreateUsageLedgerInput): Promise<UsageLedgerRecord> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        INSERT INTO usage_ledger (user_id, subscription_id, operation_type)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, subscription_id, operation_type, units, created_at
      `,
      [input.userId, input.subscriptionId ?? null, input.operationType],
    );

    if (result.rowCount === 0) {
      throw new Error("Failed to insert usage ledger row");
    }

    return rowToUsageLedger(result.rows[0]);
  }

  async findByUserId(userId: number): Promise<UsageLedgerRecord[]> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, user_id, subscription_id, operation_type, units, created_at
        FROM usage_ledger
        WHERE user_id = $1
        ORDER BY created_at DESC
      `,
      [userId],
    );

    return result.rows.map(rowToUsageLedger);
  }

  async findByUserIdAndSubscription(
    userId: number,
    subscriptionId: number,
  ): Promise<UsageLedgerRecord[]> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, user_id, subscription_id, operation_type, units, created_at
        FROM usage_ledger
        WHERE user_id = $1 AND subscription_id = $2
        ORDER BY created_at DESC
      `,
      [userId, subscriptionId],
    );

    return result.rows.map(rowToUsageLedger);
  }
}