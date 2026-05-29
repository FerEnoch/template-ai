import { Module } from "@nestjs/common";
import { DatabaseModule } from "../infrastructure/postgres/database.module";
import { AiModule } from "../ai/ai.module.js";
import { AnalysisController } from "./analysis.controller";
import { AnalysisService } from "./analysis.service";

@Module({
  imports: [DatabaseModule, AiModule],
  controllers: [AnalysisController],
  providers: [AnalysisService],
  exports: [AnalysisService],
})
export class AnalysisModule {}