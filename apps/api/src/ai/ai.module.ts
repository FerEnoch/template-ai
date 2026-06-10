import { Module } from "@nestjs/common";
import { CacheModule } from "../infrastructure/redis/index.js";
import { OpenRouterService } from "./open-router.service.js";
import { DocumentAnalysisService } from "./document-analysis.service.js";

@Module({
  imports: [CacheModule],
  providers: [OpenRouterService, DocumentAnalysisService],
  exports: [DocumentAnalysisService, OpenRouterService],
})
export class AiModule {}