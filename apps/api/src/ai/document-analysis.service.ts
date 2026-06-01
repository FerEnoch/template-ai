import { Injectable, Logger } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { OpenRouterService, OpenRouterError } from "./open-router.service.js";
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
  error?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

@Injectable()
export class DocumentAnalysisService {
  private readonly logger = new Logger(DocumentAnalysisService.name);

  constructor(private readonly openRouterService: OpenRouterService) {}

  /**
   * Extracts text content from a file based on its extension.
   * Supports PDF (via pdf-parse), DOCX (via mammoth), and plain text formats.
   */
  private async extractText(filePath: string): Promise<string> {
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
  ): Promise<AnalyzeResult> {
    if (!filePath) {
      return { success: false, error: "File not found" };
    }

    // Extract text based on file type
    let fileContent: string;
    try {
      fileContent = await this.extractText(filePath);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to extract text from file",
      };
    }

    // Call AI with retry on rate limit
    try {
      const aiResult = await this.callAiWithRetry(fileContent);

      return {
        success: true,
        extractedText: fileContent,
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

  /**
   * Call AI extraction with exponential backoff on rate limits.
   * Primary model → (rate limit?) → fallback model → (rate limit?) → wait → retry.
   * Gives up after exhausting all attempts.
   */
  private async callAiWithRetry(fileContent: string) {
    // Retryable error codes — transient failures worth re-attempting.
    // CONFIG_ERROR (bad API key, model not found) is NOT retried.
    const retryableCodes = ["RATE_LIMIT", "NETWORK_ERROR", "INVALID_RESPONSE"];
    // Exponential-ish backoff: 1s, 3s → 3 total attempts (initial + 2 retries)
    const delays = [1_000, 3_000];
    let lastError: unknown;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        if (attempt > 0) {
          const delay = delays[attempt - 1];
          this.logger.warn(
            `AI call failed (attempt ${attempt}) — retrying in ${delay / 1000}s...`,
          );
          await sleep(delay);
        }
        return await this.openRouterService.extractEntities(fileContent);
      } catch (error) {
        lastError = error;
        if (
          error instanceof OpenRouterError &&
          retryableCodes.includes(error.code) &&
          attempt < delays.length
        ) {
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }
}