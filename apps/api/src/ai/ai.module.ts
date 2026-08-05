import { Module } from "@nestjs/common";
import { CacheModule } from "../infrastructure/redis/index.js";
import { AI_CONFIG } from "../config/ai.js";
import { PostgresService } from "../infrastructure/postgres/postgres.service.js";
import { EntitiesRepository } from "../infrastructure/postgres/repositories/entities.repository.js";
import { OpenRouterService } from "./open-router.service.js";
import { DocumentAnalysisService } from "./document-analysis.service.js";
import { DocumentGenerationService } from "./document-generation.service.js";
import { PromptEngine } from "./prompt-engine.js";
import { FewShotProvider } from "./few-shot-provider.js";
import { GroupsService } from "./groups.service.js";
import { VerificationService } from "./verification.service.js";

const fewShotProvider = {
  provide: FewShotProvider,
  inject: [PostgresService],
  useFactory: (postgres: PostgresService) =>
    new FewShotProvider(
      {
        findReviewedForFewShot: async (userId: number) =>
          postgres.withOwnerTransaction(userId, async ({ client }) => {
            const repo = new EntitiesRepository(client);
            return repo.findReviewedForFewShot(userId);
          }),
      },
      { maxTokens: AI_CONFIG.maxTokens },
    ),
};

@Module({
  imports: [CacheModule],
  providers: [
    PromptEngine,
    fewShotProvider,
    GroupsService,
    OpenRouterService,
    DocumentAnalysisService,
    DocumentGenerationService,
    VerificationService,
  ],
  exports: [
    PromptEngine,
    FewShotProvider,
    GroupsService,
    DocumentAnalysisService,
    DocumentGenerationService,
    OpenRouterService,
    VerificationService,
  ],
})
export class AiModule {}
