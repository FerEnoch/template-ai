import { Injectable, Logger } from "@nestjs/common";
import type { Redis } from "ioredis";
import type { CachePort } from "./cache.port.js";

/**
 * Redis-backed cache adapter implementing CachePort.
 * All operations are fault-tolerant: errors are logged and return null/undefined.
 * Never throws — cache failures degrade gracefully to misses.
 */
@Injectable()
export class RedisCacheAdapter implements CachePort {
  private readonly logger = new Logger(RedisCacheAdapter.name);

  constructor(
    private readonly redis: Redis,
    private readonly maxEntryBytes: number,
  ) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      if (raw === null) {
        return null;
      }

      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.warn(
        {
          cache_layer: "redis",
          key,
          error: error instanceof Error ? error.message : String(error),
        },
        "cache get failed",
      );
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const sizeBytes = Buffer.byteLength(serialized, "utf-8");

      if (sizeBytes > this.maxEntryBytes) {
        this.logger.warn(
          {
            cache_layer: "redis",
            key,
            size_bytes: sizeBytes,
            max_bytes: this.maxEntryBytes,
          },
          "cache entry exceeds max size, skipping write",
        );
        return;
      }

      await this.redis.set(key, serialized, "EX", ttlSeconds);
    } catch (error) {
      this.logger.warn(
        {
          cache_layer: "redis",
          key,
          error: error instanceof Error ? error.message : String(error),
        },
        "cache set failed",
      );
    }
  }

  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}
