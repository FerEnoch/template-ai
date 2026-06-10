/**
 * Port interface for cache operations.
 * Services depend on this abstraction, not on ioredis directly.
 * All implementations must be fault-tolerant: errors return null, never throw.
 */
export interface CachePort {
  /**
   * Retrieve a cached value by key.
   * @returns The deserialized value, or null if not found or on error.
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Store a value with a TTL.
   * Silently skips write if value exceeds max entry size.
   * @param ttlSeconds Time-to-live in seconds.
   */
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;

  /**
   * Retrieve or compute and cache a value.
   * On cache miss, calls factory(), caches the result, and returns it.
   * On Redis error, calls factory() without caching.
   */
  getOrSet<T>(
    key: string,
    ttlSeconds: number,
    factory: () => Promise<T>,
  ): Promise<T>;
}

/**
 * NestJS injection token for CachePort.
 */
export const CACHE_PORT = Symbol("CACHE_PORT");
