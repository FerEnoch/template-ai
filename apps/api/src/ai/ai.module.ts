import { Module } from "@nestjs/common";
import { CacheModule } from "../infrastructure/redis/index.js";
import { OpenRouterService } from "./open-router.service.js";
import { DocumentAnalysisService } from "./document-analysis.service.js";
import { DocumentGenerationService } from "./document-generation.service.js";
import { PromptEngine } from "./prompt-engine.js";

@Module({
  imports: [CacheModule],
  providers: [
    PromptEngine,
    OpenRouterService,
    DocumentAnalysisService,
    DocumentGenerationService,
  ],
  exports: [
    PromptEngine,
    DocumentAnalysisService,
    DocumentGenerationService,
    OpenRouterService,
  ],
})
export class AiModule {}
