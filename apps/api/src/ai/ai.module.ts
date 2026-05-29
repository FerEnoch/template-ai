import { Module } from "@nestjs/common";
import { OpenRouterService } from "./open-router.service.js";
import { DocumentAnalysisService } from "./document-analysis.service.js";

@Module({
  providers: [OpenRouterService, DocumentAnalysisService],
  exports: [DocumentAnalysisService],
})
export class AiModule {}