import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { DatabaseModule } from "./infrastructure/postgres/database.module";
import { DomainSchemaFirstModule } from "./domain-schema-first/domain-schema-first.module";
import { DocumentsModule } from "./documents/documents.module";
import { AnalysisModule } from "./analysis/analysis.module";
import { ReviewModule } from "./review/review.module";
import { TemplatesModule } from "./templates/templates.module";

@Module({
  controllers: [HealthController],
  imports: [
    DatabaseModule,
    DomainSchemaFirstModule,
    DocumentsModule,
    AnalysisModule,
    ReviewModule,
    TemplatesModule,
  ],
})
export class AppModule {}
