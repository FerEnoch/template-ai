import { Injectable } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { OpenRouterService } from "./open-router.service.js";

export interface AnalyzeResult {
  success: boolean;
  entities?: Array<{
    label: string;
    value: string;
    group: string;
    confidence: string;
    sourceSpan?: { start: number; end: number };
  }>;
  error?: string;
}

@Injectable()
export class DocumentAnalysisService {
  constructor(private readonly openRouterService: OpenRouterService) {}

  /**
   * Orchestrates file read → AI extraction.
   * Returns extracted entities on success, or error details on failure.
   * Does NOT touch the database — the caller handles entity insertion and status updates.
   */
  async analyze(
    filePath: string | null,
  ): Promise<AnalyzeResult> {
    // Read file from disk
    let fileContent: string;
    try {
      if (!filePath) {
        return { success: false, error: "File not found" };
      }
      fileContent = readFileSync(filePath, "utf8");
    } catch {
      return { success: false, error: "File not found" };
    }

    // Call AI to extract entities
    try {
      const aiResult = await this.openRouterService.extractEntities(fileContent);

      return {
        success: true,
        entities: aiResult.entities.map((e) => ({
          label: e.label,
          value: e.value,
          group: e.group,
          confidence: e.confidence,
          sourceSpan: e.sourceSpan,
        })),
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI extraction failed";

      return { success: false, error: message };
    }
  }
}