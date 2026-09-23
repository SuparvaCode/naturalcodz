
import { choice } from "@typesafe-ai/sdk";
import { getClient, getModel, getDefaultConfidenceThreshold } from "../client.js";
import type {
  ClassifyDimension,
  ClassifyResult,
  MultiClassifyResult,
  State,
} from "../types.js";
import { APICallError } from "../utils/errors.js";

/**
 * Classify an input across multiple dimensions in a single API call.
 *
 * Each dimension asks a separate Choice question. All are evaluated
 * in parallel by the Jev model in one request (speculative fan-out).
 *
 * @param input - The text or structured state to classify.
 * @param dimensions - A map of dimension IDs to their configs.
 * @returns A map of dimension IDs to ClassifyResult objects.
 *
 * @example
 * ```ts
 * const results = await multiClassify(ticket, {
 *   department: {
 *     instructions: "Which department should handle this?",
 *     categories: { billing: "Payment issues", tech: "Technical bugs" },
 *   },
 *   priority: {
 *     instructions: "What is the priority level?",
 *     categories: { low: null, medium: null, high: null, critical: null },
 *   },
 * });
 * console.log(results.department.choice); // "tech"
 * console.log(results.priority.choice);   // "high"
 * ```
 */
export async function multiClassify(
  input: State,
  dimensions: Record<string, ClassifyDimension>,
): Promise<MultiClassifyResult> {
  const client = getClient();
  const model = getModel();
  const defaultThreshold = getDefaultConfidenceThreshold();

  // Build all Choice questions for a single fan-out request.
  const questions: Record<string, ReturnType<typeof choice>> = {};
  for (const [dimId, dim] of Object.entries(dimensions)) {
    questions[dimId] = choice(dim.instructions, dim.categories);
  }

  try {
    const response = await client.systemOne({
      state: input,
      model,
      questions,
    });

    const results: MultiClassifyResult = {};

    for (const [dimId, dim] of Object.entries(dimensions)) {
      const answer = response.answers[dimId];
      if (answer && answer.type === "choice") {
        const threshold = dim.confidenceThreshold ?? defaultThreshold;
        results[dimId] = {
          choice: answer.choice,
          confidence: answer.confidence,
          probabilities: answer.probabilities as Record<string, number>,
          isConfident: answer.confidence >= threshold,
        };
      }
    }

    return results;
  } catch (error) {
    throw new APICallError(
      `multiClassify() failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error,
    );
  }
}
