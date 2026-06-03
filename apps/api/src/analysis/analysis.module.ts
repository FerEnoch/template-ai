import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { DatabaseModule } from "../infrastructure/postgres/database.module";
import { AiModule } from "../ai/ai.module.js";
import { AnalysisController } from "./analysis.controller";
import { AnalysisProcessor } from "./analysis.processor";
import { ANALYSIS_QUEUE } from "./analysis.queue";
import { AnalysisService } from "./analysis.service";

@Module({
  imports: [
    DatabaseModule,
    AiModule,
    BullModule.registerQueue({
      name: ANALYSIS_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 200,
      },
    }),
  ],
  controllers: [AnalysisController],
  providers: [AnalysisService, AnalysisProcessor],
  exports: [AnalysisService],
})
export class AnalysisModule {}
