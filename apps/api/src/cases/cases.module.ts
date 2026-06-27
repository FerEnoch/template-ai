import { Module } from "@nestjs/common";
import { DatabaseModule } from "../infrastructure/postgres/database.module";
import { AiModule } from "../ai/ai.module.js";
import { CasesController } from "./cases.controller";
import { CasesService } from "./cases.service";
import { DocumentGenerationService } from "../ai/document-generation.service.js";

@Module({
  imports: [DatabaseModule, AiModule],
  controllers: [CasesController],
  providers: [CasesService, DocumentGenerationService],
  exports: [CasesService],
})
export class CasesModule {}
