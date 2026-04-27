import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PostgresService } from "../infrastructure/postgres/postgres.service";

@Controller()
export class HealthController {
  public constructor(private readonly postgresService: PostgresService) {}

  @Get("health")
  public health() {
    return { status: "ok" };
  }

  @Get("ready")
  public async ready() {
    const isReady = await this.postgresService.ready();

    if (!isReady) {
      throw new ServiceUnavailableException({ status: "not_ready" });
    }

    return { status: "ready" };
  }
}
