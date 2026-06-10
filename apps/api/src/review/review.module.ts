import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { DatabaseModule } from "../infrastructure/postgres/database.module";
import { ReviewController } from "./review.controller";
import { ReviewService } from "./review.service";

@Module({
  imports: [DatabaseModule, AiModule],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewModule {}