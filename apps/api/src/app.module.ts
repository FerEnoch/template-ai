import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { HealthController } from "./health/health.controller";
import { DatabaseModule } from "./infrastructure/postgres/database.module";
import { CacheModule } from "./infrastructure/redis/redis-cache.module";
import { DomainSchemaFirstModule } from "./domain-schema-first/domain-schema-first.module";
import { DocumentsModule } from "./documents/documents.module";
import { AnalysisModule } from "./analysis/analysis.module";
import { ReviewModule } from "./review/review.module";
import { TemplatesModule } from "./templates/templates.module";
import { AiModule } from "./ai/ai.module.js";

@Module({
  controllers: [HealthController],
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? "localhost",
        port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
      },
    }),
    DatabaseModule,
    CacheModule,
    DomainSchemaFirstModule,
    DocumentsModule,
    AnalysisModule,
    ReviewModule,
    TemplatesModule,
    AiModule,
  ],
})
export class AppModule {}
