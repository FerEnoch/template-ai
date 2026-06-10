import { Module } from "@nestjs/common";
import Redis from "ioredis";
import { getApiEnv } from "../../config/env.js";
import { CACHE_CONFIG } from "../../config/ai.js";
import { CACHE_PORT } from "./cache.port.js";
import { RedisCacheAdapter } from "./redis-cache.adapter.js";

/**
 * Dedicated Redis module for caching operations.
 * Creates a separate ioredis client (not shared with BullMQ) for isolation.
 * Provides CACHE_PORT token for dependency injection.
 */
@Module({
  providers: [
    {
      provide: "CACHE_REDIS_CLIENT",
      useFactory: () => {
        const env = getApiEnv();
        return new Redis({
          host: env.REDIS_HOST,
          port: env.REDIS_PORT,
          maxRetriesPerRequest: null, // Required for BullMQ compatibility
          lazyConnect: true,
        });
      },
    },
    {
      provide: CACHE_PORT,
      useFactory: (redis: Redis) => {
        return new RedisCacheAdapter(redis, CACHE_CONFIG.maxEntryBytes);
      },
      inject: ["CACHE_REDIS_CLIENT"],
    },
  ],
  exports: [CACHE_PORT],
})
export class CacheModule {}
