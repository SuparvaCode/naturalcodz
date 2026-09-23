
import { score as jevScore } from "@typesafe-ai/sdk";
import { getClient, getModel } from "../client.js";
import type { ScoreConfig, ScoreResult, State } from "../types.js";
import { APICallError, NoAnswerError } from "../utils/errors.js";

/**
 * Score an input against an ordered rubric.
 *
 * Accepts either:
 * - A simple string array: `["low", "medium", "high", "critical"]`
 * - A full config object: `{ rubric: [...], instructions: "..." }`
 *
 * @param input - The text or structured state to score.
 * @param rubricOrConfig - Either an array of rubric levels or a ScoreConfig object.
 * @param instructions - Optional instructions when passing a rubric array.
 * @returns A ScoreResult with the score, label, confidence, and normalized value.
 *
 * @example
 * ```ts
 * // Simple array form:
 * const result = await score(ticket, ["low", "medium", "high", "critical"]);
 * console.log(result.label); // "high"
 * ```
 */
export async function score(
  input: State,
  rubricOrConfig: ScoreConfig | string[],
  instructions?: string,
): Promise<ScoreResult> {
  const client = getClient();
  const model = getModel();

  const config: ScoreConfig = Array.isArray(rubricOrConfig)
    ? {
        rubric: rubricOrConfig,
        instructions:
          instructions ?? "Evaluate and score this input against the given levels:",
      }
    : rubricOrConfig;

  try {
    const response = await client.systemOne({
      state: input,
      model,
      questions: {
        scoring: jevScore(config.instructions, config.rubric as [string, string, ...string[]]),
      },
    });

    const answer = response.answers.scoring;
    if (!answer || answer.type !== "score") {
      throw new NoAnswerError("scoring");
    }

    const maxLevel = config.rubric.length - 1;
    const normalized = maxLevel > 0 ? answer.score / maxLevel : 0;

    // Find the label for the score (round to nearest level).
    const levelIndex = Math.round(
      Math.min(Math.max(answer.score, 0), maxLevel),
    );
    const label = config.rubric[levelIndex] ?? config.rubric[0]!;

    return {
      score: answer.score,
      label,
      confidence: answer.confidence,
      normalized,
      probabilities: answer.probabilities as Record<string, number>,
      legend: answer.legend as Record<string, string>,
    };
  } catch (error) {
    if (error instanceof NoAnswerError) throw error;
    throw new APICallError(
      `score() failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error,
    );
  }
}
