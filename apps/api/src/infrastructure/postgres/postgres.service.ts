import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool, PoolClient } from "pg";
import { getApiEnv } from "../../config/env";

export type TransactionContext = {
  client: PoolClient;
  ownerId: number;
};

@Injectable()
export class PostgresService implements OnModuleDestroy {
  private readonly pool: Pool;

  public constructor() {
    this.pool = new Pool({
      connectionString: getApiEnv().DATABASE_URL,
    });
  }

  public async ready(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  public async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  /**
   * Execute a callback within an owner-scoped transaction.
   * Sets `app.current_user_id` session variable for the duration of the transaction,
   * enabling RLS policies to enforce row isolation.
   */
  public async withOwnerTransaction<T>(
    ownerId: number,
    callback: (ctx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL app.current_user_id = $1`, [ownerId]);

      const result = await callback({ client, ownerId });

      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

}
