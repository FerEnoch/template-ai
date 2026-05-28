import { Controller, Get, Param, NotFoundException } from "@nestjs/common";
import { AnalysisService, AnalysisResult, AnalysisStatus } from "./analysis.service";

@Controller("analysis")
export class AnalysisController {
  public constructor(private readonly analysisService: AnalysisService) {}

  /**
   * GET /:id — Full analysis result with entities.
   * Each call increments progress by ~25. When complete, includes entities.
   */
  @Get(":id")
  public async getFullResult(@Param("id") id: string): Promise<AnalysisResult> {
    return this.analysisService.getFullResult(id);
  }

  /**
   * GET /:id/status — Lightweight poll returning only documentId, status, progress.
   */
  @Get(":id/status")
  public async getStatus(@Param("id") id: string): Promise<AnalysisStatus> {
    return this.analysisService.getStatus(id);
  }
}