import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { DatabaseModule } from "./infrastructure/postgres/database.module";
import { DomainSchemaFirstModule } from "./domain-schema-first/domain-schema-first.module";

@Module({
  controllers: [HealthController],
  imports: [DatabaseModule, DomainSchemaFirstModule],
})
export class AppModule {}
