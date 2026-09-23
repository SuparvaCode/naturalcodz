
import { score as jevScore } from "@typesafe-ai/sdk";
import { getClient, getModel } from "../client.js";
import type {
  ScoreDimension,
  ScoreResult,
  CompositeScoreResult,
  State,
} from "../types.js";
import { APICallError } from "../utils/errors.js";

/**
 * Score an input across multiple weighted dimensions and combine
 * them into a single composite score.
 *
 * All dimensions are evaluated in a single API call (fan-out).
 * The composite total is the weighted sum of each dimension's
 * normalized score (0–1), where weights are normalized to sum to 1.
 *
 * @param input - The text or structured state to score.
 * @param dimensions - A map of dimension IDs to their configs.
 * @returns A CompositeScoreResult with the weighted total and per-dimension details.
 *
 * @example
 * ```ts
 * const priority = await compositeScore(ticket, {
 *   severity: {
 *     weight: 0.4,
 *     rubric: ["Cosmetic", "Degraded", "Broken", "Total outage"],
 *     instructions: "How severe is the reported issue?"
 *   },
 *   frustration: {
 *     weight: 0.3,
 *     rubric: ["Calm", "Frustrated", "Very angry"],
 *     instructions: "How frustrated is the customer?"
 *   },
 *   actionability: {
 *     weight: 0.3,
 *     rubric: ["Vague", "Some info", "Detailed with steps"],
 *     instructions: "How actionable is this report?"
 *   },
 * });
 * console.log(priority.total);         // 0.72
 * console.log(priority.minConfidence); // 0.75
 * ```
 */
export async function compositeScore(
  input: State,
  dimensions: Record<string, ScoreDimension>,
): Promise<CompositeScoreResult> {
  const client = getClient();
  const model = getModel();

  // Build one Score question per dimension.
  const questions: Record<string, ReturnType<typeof jevScore>> = {};
  for (const [dimId, dim] of Object.entries(dimensions)) {
    questions[dimId] = jevScore(dim.instructions, dim.rubric as [string, string, ...string[]]);
  }

  try {
    const response = await client.systemOne({
      state: input,
      model,
      questions,
    });

    // Normalize weights so they sum to 1.
    const entries = Object.entries(dimensions);
    const totalWeight = entries.reduce((sum, [, d]) => sum + d.weight, 0);

    const dimResults: Record<string, ScoreResult & { weight: number }> = {};
    let compositeTotal = 0;
    let minConfidence = 1;

    for (const [dimId, dim] of entries) {
      const answer = response.answers[dimId];
      if (!answer || answer.type !== "score") continue;

      const maxLevel = dim.rubric.length - 1;
      const normalized = maxLevel > 0 ? answer.score / maxLevel : 0;
      const normalizedWeight = totalWeight > 0 ? dim.weight / totalWeight : 0;

      const levelIndex = Math.round(
        Math.min(Math.max(answer.score, 0), maxLevel),
      );
      const label = dim.rubric[levelIndex] ?? dim.rubric[0]!;

      dimResults[dimId] = {
        score: answer.score,
        label,
        confidence: answer.confidence,
        normalized,
        probabilities: answer.probabilities as Record<string, number>,
        legend: answer.legend as Record<string, string>,
        weight: normalizedWeight,
      };

      compositeTotal += normalized * normalizedWeight;
      minConfidence = Math.min(minConfidence, answer.confidence);
    }

    return {
      total: Math.round(compositeTotal * 1000) / 1000,
      dimensions: dimResults,
      minConfidence,
    };
  } catch (error) {
    throw new APICallError(
      `compositeScore() failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error,
    );
  }
}
