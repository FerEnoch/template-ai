import { Logger } from "@nestjs/common";
import type { EntityRecord } from "../infrastructure/postgres/repositories/entities.repository.js";

/**
 * Data source abstraction for FewShotProvider.
 * Production wiring uses EntitiesRepository; unit tests can pass a stub.
 */
export interface FewShotDataSource {
  findReviewedForFewShot(userId: number): Promise<EntityRecord[]>;
}

export interface FewShotProviderOptions {
  maxTokens: number;
}

/**
 * Provides Spanish few-shot examples from a user's reviewed entities.
 *
 * - Queries the most recent 3 reviewed, non-excluded entities across all
 *   documents for the user.
 * - Formats them as a Spanish example block.
 * - Caps the block at ~25% of the configured token budget (1 token ≈ 4 chars).
 *   If even a single example exceeds the budget, degrades to an empty string.
 * - Query failures degrade to an empty string with a warning so extraction
 *   never blocks on few-shot retrieval.
 */
export class FewShotProvider {
  private readonly logger = new Logger(FewShotProvider.name);

  constructor(
    private readonly dataSource: FewShotDataSource,
    private readonly options: FewShotProviderOptions,
  ) {}

  async getExamples(userId: number): Promise<string> {
    try {
      const entities = await this.dataSource.findReviewedForFewShot(userId);
      if (entities.length === 0) {
        return "";
      }
      return this.formatWithinBudget(entities);
    } catch (error) {
      this.logger.warn(
        `few-shot query failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return "";
    }
  }

  /**
   * Try to fit as many examples as possible under the budget, falling back
   * to one example and finally to an empty string.
   */
  private formatWithinBudget(entities: EntityRecord[]): string {
    const tokenBudget = Math.floor(this.options.maxTokens * 0.25);
    const charBudget = tokenBudget * 4; // 1 token ≈ 4 characters

    for (const count of [entities.length, 1]) {
      if (count <= 0) {
        continue;
      }

      const block = this.formatBlock(entities.slice(0, count));
      if (block.length <= charBudget) {
        if (count < entities.length) {
          this.logger.warn(
            `few-shot block exceeded 25% token budget; truncated to ${count} example(s).`,
          );
        }
        return block;
      }
    }

    this.logger.warn(
      "few-shot block exceeded 25% token budget even with one example; returning empty.",
    );
    return "";
  }

  private formatBlock(entities: EntityRecord[]): string {
    const lines = entities.map((entity) => {
      const example = {
        etiqueta: entity.label,
        grupo: entity.group,
        valor: entity.value,
        confianza: entity.confidence,
      };
      return `- ${JSON.stringify(example)}`;
    });

    return `Ejemplos de entidades revisadas por el usuario:\n${lines.join("\n")}\n`;
  }
}
