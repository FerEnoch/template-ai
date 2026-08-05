import { Inject, Injectable, Logger } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { OpenRouterService } from "./open-router.service.js";
import { CACHE_PORT, type CachePort } from "../infrastructure/redis/index.js";
import { CACHE_CONFIG } from "../config/ai.js";
import { FewShotProvider } from "./few-shot-provider.js";
import { GroupsService } from "./groups.service.js";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

export interface AnalyzeResult {
  success: boolean;
  extractedText?: string;
  entities?: Array<{
    label: string;
    value: string;
    group: string;
    confidence: string;
    sourceSpan?: { start: number; end: number };
  }>;
  suggestedGroups?: string[];
  error?: string;
}

type AnalyzeEntity = NonNullable<AnalyzeResult["entities"]>[number];

export function validateAndCorrectSpans(
  entities: AnalyzeEntity[],
  extractedText: string,
): AnalyzeEntity[] {
  return entities.map((entity) => {
    const corrected = { ...entity };

    if (!corrected.sourceSpan || !corrected.value) {
      return corrected;
    }

    const matches: number[] = [];
    let fromIndex = 0;

    while (fromIndex <= extractedText.length) {
      const matchIndex = extractedText.indexOf(corrected.value, fromIndex);
      if (matchIndex === -1) {
        break;
      }

      matches.push(matchIndex);
      fromIndex = matchIndex + 1;
    }

    if (matches.length === 0) {
      corrected.sourceSpan = undefined;
      return corrected;
    }

    if (matches.length === 1) {
      const [start] = matches;
      corrected.sourceSpan = { start, end: start + corrected.value.length };
      return corrected;
    }

    const aiStart = corrected.sourceSpan.start;
    const closestStart = matches.reduce((closest, current) => {
      const currentDistance = Math.abs(current - aiStart);
      const closestDistance = Math.abs(closest - aiStart);
      return currentDistance < closestDistance ? current : closest;
    }, matches[0]);

    corrected.sourceSpan = {
      start: closestStart,
      end: closestStart + corrected.value.length,
    };

    return corrected;
  });
}

@Injectable()
export class DocumentAnalysisService {
  private readonly logger = new Logger(DocumentAnalysisService.name);

  constructor(
    private readonly openRouterService: OpenRouterService,
    @Inject(CACHE_PORT) private readonly cachePort: CachePort,
    private readonly fewShotProvider: FewShotProvider,
    private readonly groupsService: GroupsService,
  ) {}

  /**
   * Extracts text content from a file based on its extension.
   * When cache is enabled and contentHash is provided, checks Redis before running extractors.
   */
  private async extractText(filePath: string, contentHash?: string): Promise<string> {
    if (CACHE_CONFIG.enabled && contentHash) {
      return this.cachePort.getOrSet(
        `ai:text:${contentHash}`,
        CACHE_CONFIG.textCacheTtl,
        () => this.doExtractText(filePath),
      );
    }
    return this.doExtractText(filePath);
  }

  /**
   * Runs the actual text extraction (pdf-parse, mammoth, or raw read).
   * Called directly on cache miss or when caching is disabled.
   */
  private async doExtractText(filePath: string): Promise<string> {
    const ext = extname(filePath).toLowerCase();

    if (ext === ".pdf") {
      const buffer = readFileSync(filePath);
      const data = await pdfParse(buffer);
      const text = data.text?.trim();
      if (!text) {
        throw new Error(
          "PDF appears to be scanned or contains no extractable text. OCR is not supported yet.",
        );
      }
      return text;
    }

    if (ext === ".docx") {
      const buffer = readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value?.trim();
      if (!text) {
        throw new Error("DOCX contains no extractable text.");
      }
      return text;
    }

    if (ext === ".txt" || ext === ".csv" || ext === ".md" || ext === ".json") {
      return readFileSync(filePath, "utf8");
    }

    throw new Error(
      `File type "${ext}" is not supported for text extraction. Only PDF, DOCX, TXT, CSV, MD, and JSON files can be analyzed.`,
    );
  }

  /**
   * Orchestrates file read → AI extraction.
   * Returns extracted entities on success, or error details on failure.
   * Does NOT touch the database — the caller handles entity insertion and status updates.
   */
  async analyze(
    filePath: string | null,
    contentHash?: string,
    userId?: number,
    templateId?: string,
  ): Promise<AnalyzeResult> {
    if (!filePath) {
      return { success: false, error: "File not found" };
    }

    // Extract text based on file type
    let fileContent: string;
    try {
      fileContent = await this.extractText(filePath, contentHash);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to extract text from file",
      };
    }

    // Call AI with retry on rate limit
    try {
      const aiResult = await this.callAiWithRetry(
        fileContent,
        userId ?? 0,
        templateId,
      );
      const entities = aiResult.entities.map((e) => ({
        label: e.label,
        value: e.value,
        group: e.group,
        confidence: e.confidence,
        sourceSpan: e.sourceSpan,
      }));

      const correctedEntities = validateAndCorrectSpans(entities, fileContent);

      return {
        success: true,
        extractedText: fileContent,
        entities: correctedEntities,
        suggestedGroups: aiResult.suggestedGroups,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "AI extraction failed";

      return { success: false, error: message };
    }
  }

  /**
   * Build context-aware prompt inputs and delegate to OpenRouterService.
   * Retry is handled internally by callWithRetryChain (3 primary + 1 fallback).
   */
  private async callAiWithRetry(
    fileContent: string,
    userId: number,
    templateId?: string,
  ) {
    const [fewShot, groups] = await Promise.all([
      this.fewShotProvider.getExamples(userId),
      this.groupsService.resolve(templateId),
    ]);

    return this.openRouterService.extractEntities({
      documentText: fileContent,
      userId,
      groups,
      fewShot,
    });
  }
}
