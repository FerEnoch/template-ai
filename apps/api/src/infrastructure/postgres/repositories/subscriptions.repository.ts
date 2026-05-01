import { PoolClient } from "pg";

export type AccessStatus = "activa" | "limitada" | "sin_acceso" | "cancelada";

export interface SubscriptionRecord {
  id: number;
  userId: number;
  status: AccessStatus;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionInput {
  userId: number;
  status: AccessStatus;
  periodStart: Date;
  periodEnd: Date;
}

function rowToSubscription(row: Record<string, unknown>): SubscriptionRecord {
  return {
    id: row["id"] as number,
    userId: row["user_id"] as number,
    status: row["status"] as AccessStatus,
    periodStart: row["period_start"] as Date,
    periodEnd: row["period_end"] as Date,
    createdAt: row["created_at"] as Date,
    updatedAt: row["updated_at"] as Date,
  };
}

export class SubscriptionsRepository {
  constructor(private readonly client: PoolClient) {}

  async create(input: CreateSubscriptionInput): Promise<SubscriptionRecord> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        INSERT INTO subscriptions (user_id, status, period_start, period_end)
        VALUES ($1, $2, $3, $4)
        RETURNING id, user_id, status, period_start, period_end, created_at, updated_at
      `,
      [input.userId, input.status, input.periodStart, input.periodEnd],
    );

    if (result.rowCount === 0) {
      throw new Error("Failed to insert subscription");
    }

    return rowToSubscription(result.rows[0]);
  }

  async findById(id: number): Promise<SubscriptionRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, user_id, status, period_start, period_end, created_at, updated_at
        FROM subscriptions
        WHERE id = $1
      `,
      [id],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToSubscription(result.rows[0]);
  }

  async findActiveByUserId(userId: number, now: Date = new Date()): Promise<SubscriptionRecord | null> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, user_id, status, period_start, period_end, created_at, updated_at
        FROM subscriptions
        WHERE user_id = $1
          AND status = 'activa'
          AND period_start <= $2
          AND period_end > $2
        ORDER BY period_start DESC
        LIMIT 1
      `,
      [userId, now],
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return null;
    }

    return rowToSubscription(result.rows[0]);
  }

  async findByUserId(userId: number): Promise<SubscriptionRecord[]> {
    const result = await this.client.query<Record<string, unknown>>(
      `
        SELECT id, user_id, status, period_start, period_end, created_at, updated_at
        FROM subscriptions
        WHERE user_id = $1
        ORDER BY period_start DESC
      `,
      [userId],
    );

    return result.rows.map(rowToSubscription);
  }
}