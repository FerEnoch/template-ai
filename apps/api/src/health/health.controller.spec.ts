import { describe, expect, it, vi } from "vitest";
import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "./health.controller";
import type { PostgresService } from "../infrastructure/postgres/postgres.service";

describe("HealthController", () => {
  it("returns ok for liveness without DB calls", () => {
    const ready = vi.fn(async () => true);
    const postgresService = {
      ready,
    } as unknown as PostgresService;
    const controller = new HealthController(postgresService);

    expect(controller.health()).toEqual({ status: "ok" });
    expect(ready).not.toHaveBeenCalled();
  });

  it("returns ready when postgres readiness succeeds", async () => {
    const postgresService = {
      ready: async () => true,
    } as unknown as PostgresService;
    const controller = new HealthController(postgresService);

    await expect(controller.ready()).resolves.toEqual({ status: "ready" });
  });

  it("throws 503 when postgres readiness fails", async () => {
    const postgresService = {
      ready: async () => false,
    } as unknown as PostgresService;
    const controller = new HealthController(postgresService);

    try {
      await controller.ready();
      throw new Error("Expected ready() to throw ServiceUnavailableException");
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect(error).toMatchObject({
        response: { status: "not_ready" },
        status: 503,
      });
    }
  });
});
