import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { PostgresService } from "./infrastructure/postgres/postgres.service";

@Module({
  controllers: [HealthController],
  providers: [PostgresService],
})
export class AppModule {}
