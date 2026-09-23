
import { choice } from "@typesafe-ai/sdk";
import { getClient, getModel } from "../client.js";
import type { PickBestResult, State } from "../types.js";
import { APICallError, NoAnswerError } from "../utils/errors.js";

/**
 * Pick the best candidate from a list given a context and criteria.
 *
 * Converts candidates into a Choice question. Useful for re-ranking,
 * best-match selection, and recommendation scenarios.
 *
 * @param context - The state/context against which to evaluate candidates.
 * @param candidates - An array of candidate labels or descriptions.
 * @param criteria - The question/criteria for selecting the best candidate.
 * @returns A PickBestResult with the chosen candidate and confidence.
 *
 * @example
 * ```ts
 * const best = await pickBest(
 *   { query: "payment failed on checkout" },
 *   ["Stripe integration", "PayPal setup", "Invoice generation", "Tax calc"],
 *   "Which feature area is most relevant to the user's issue?"
 * );
 * console.log(best.choice);     // "Stripe integration"
 * console.log(best.confidence); // 0.85
 * ```
 */
export async function pickBest<T extends string>(
  context: State,
  candidates: T[],
  criteria: string,
): Promise<PickBestResult<T>> {
  const client = getClient();
  const model = getModel();

  // Build Choice criteria from the candidate list (label → null description).
  const choiceCriteria: Record<string, null> = {};
  for (const candidate of candidates) {
    choiceCriteria[candidate] = null;
  }

  try {
    const response = await client.systemOne({
      state: context,
      model,
      questions: {
        best: choice(criteria, choiceCriteria),
      },
    });

    const answer = response.answers.best;
    if (!answer || answer.type !== "choice") {
      throw new NoAnswerError("best");
    }

    return {
      choice: answer.choice as T,
      confidence: answer.confidence,
      probabilities: answer.probabilities as Record<T, number>,
    };
  } catch (error) {
    if (error instanceof NoAnswerError) throw error;
    throw new APICallError(
      `pickBest() failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error,
    );
  }
}
