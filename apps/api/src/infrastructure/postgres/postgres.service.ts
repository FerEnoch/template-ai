import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { getApiEnv } from "../../config/env";

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
}
