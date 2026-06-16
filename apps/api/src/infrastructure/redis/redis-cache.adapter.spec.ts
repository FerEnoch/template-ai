import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Redis } from "ioredis";
import { RedisCacheAdapter } from "./redis-cache.adapter.js";

describe("RedisCacheAdapter", () => {
  let redis: Redis;
  let adapter: RedisCacheAdapter;
  const maxEntryBytes = 1048576; // 1MB

  beforeEach(() => {
    redis = {
      get: vi.fn(),
      set: vi.fn(),
    } as unknown as Redis;

    adapter = new RedisCacheAdapter(redis, maxEntryBytes);
  });

  describe("get", () => {
    it("returns deserialized value on cache hit", async () => {
      const value = { foo: "bar", count: 42 };
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(value));

      const result = await adapter.get<typeof value>("test-key");

      expect(result).toEqual(value);
      expect(redis.get).toHaveBeenCalledWith("test-key");
    });

    it("returns null on cache miss", async () => {
      vi.mocked(redis.get).mockResolvedValue(null);

      const result = await adapter.get("missing-key");

      expect(result).toBeNull();
    });

    it("returns null on Redis error", async () => {
      vi.mocked(redis.get).mockRejectedValue(new Error("Redis connection failed"));

      const result = await adapter.get("error-key");

      expect(result).toBeNull();
    });

    it("returns null on JSON parse error", async () => {
      vi.mocked(redis.get).mockResolvedValue("invalid json {");

      const result = await adapter.get("bad-json-key");

      expect(result).toBeNull();
    });
  });

  describe("set", () => {
    it("serializes and stores value with TTL", async () => {
      const value = { data: "test" };
      vi.mocked(redis.set).mockResolvedValue("OK");

      await adapter.set("test-key", value, 3600);

      expect(redis.set).toHaveBeenCalledWith(
        "test-key",
        JSON.stringify(value),
        "EX",
        3600,
      );
    });

    it("skips write when value exceeds max entry size", async () => {
      const largeValue = "x".repeat(maxEntryBytes + 1);

      await adapter.set("large-key", largeValue, 3600);

      expect(redis.set).not.toHaveBeenCalled();
    });

    it("swallows Redis errors without throwing", async () => {
      vi.mocked(redis.set).mockRejectedValue(new Error("Redis write failed"));

      await expect(
        adapter.set("error-key", { data: "test" }, 3600),
      ).resolves.toBeUndefined();
    });
  });

  describe("getOrSet", () => {
    it("returns cached value on hit without calling factory", async () => {
      const cached = { cached: true };
      vi.mocked(redis.get).mockResolvedValue(JSON.stringify(cached));
      const factory = vi.fn();

      const result = await adapter.getOrSet("test-key", 3600, factory);

      expect(result).toEqual(cached);
      expect(factory).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it("calls factory and caches result on miss", async () => {
      const computed = { computed: true };
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(redis.set).mockResolvedValue("OK");
      const factory = vi.fn().mockResolvedValue(computed);

      const result = await adapter.getOrSet("test-key", 3600, factory);

      expect(result).toEqual(computed);
      expect(factory).toHaveBeenCalledOnce();
      expect(redis.set).toHaveBeenCalledWith(
        "test-key",
        JSON.stringify(computed),
        "EX",
        3600,
      );
    });

    it("calls factory and attempts to cache on Redis get error", async () => {
      const computed = { computed: true };
      vi.mocked(redis.get).mockRejectedValue(new Error("Redis read failed"));
      vi.mocked(redis.set).mockResolvedValue("OK");
      const factory = vi.fn().mockResolvedValue(computed);

      const result = await adapter.getOrSet("error-key", 3600, factory);

      expect(result).toEqual(computed);
      expect(factory).toHaveBeenCalledOnce();
      // set is called because getOrSet doesn't know get failed vs cache miss
      expect(redis.set).toHaveBeenCalled();
    });

    it("returns factory result even when cache set fails", async () => {
      const computed = { computed: true };
      vi.mocked(redis.get).mockResolvedValue(null);
      vi.mocked(redis.set).mockRejectedValue(new Error("Redis write failed"));
      const factory = vi.fn().mockResolvedValue(computed);

      const result = await adapter.getOrSet("error-key", 3600, factory);

      expect(result).toEqual(computed);
      expect(factory).toHaveBeenCalledOnce();
    });
  });

  describe("JSON serialization", () => {
    it("handles complex nested objects", async () => {
      const complex = {
        string: "test",
        number: 123,
        boolean: true,
        null: null,
        array: [1, 2, 3],
        nested: { foo: "bar" },
      };
      vi.mocked(redis.set).mockResolvedValue("OK");

      await adapter.set("complex-key", complex, 3600);

      expect(redis.set).toHaveBeenCalledWith(
        "complex-key",
        JSON.stringify(complex),
        "EX",
        3600,
      );
    });

    it("handles arrays", async () => {
      const array = [1, 2, 3, "four"];
      vi.mocked(redis.set).mockResolvedValue("OK");

      await adapter.set("array-key", array, 3600);

      expect(redis.set).toHaveBeenCalledWith(
        "array-key",
        JSON.stringify(array),
        "EX",
        3600,
      );
    });
  });
});
