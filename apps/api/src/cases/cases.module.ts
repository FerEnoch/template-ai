import { Module } from "@nestjs/common";
import { DatabaseModule } from "../infrastructure/postgres/database.module";
import { AiModule } from "../ai/ai.module.js";
import { CasesController } from "./cases.controller";
import { CasesService } from "./cases.service";

@Module({
  imports: [DatabaseModule, AiModule],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
