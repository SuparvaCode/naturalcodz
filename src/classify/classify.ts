
import { choice } from "@typesafe-ai/sdk";
import { getClient, getModel, getDefaultConfidenceThreshold } from "../client.js";
import type {
  CategoryInput,
  CategoryMap,
  ClassifyOptions,
  ClassifyResult,
  State,
} from "../types.js";
import { APICallError, NoAnswerError } from "../utils/errors.js";

/**
 * Classify an input into one of the given categories.
 *
 * Accepts either:
 * - A simple string array: `["refund", "billing", "support"]`
 * - An object map: `{ refund: "Customer wants money back", billing: null }`
 *
 * @param input - The text or structured state to classify.
 * @param categories - Array of category names or a map of { category: description }.
 * @param options - Optional overrides for instructions and threshold.
 * @returns A ClassifyResult with the chosen category, confidence, and probabilities.
 *
 * @example
 * ```ts
 * // Simplest form:
 * const result = await classify("cancel my plan", ["refund", "billing", "cancellation"]);
 * console.log(result.choice); // "cancellation"
 * ```
 */
export async function classify<T extends string>(
  input: State,
  categories: CategoryInput<T>,
  options?: ClassifyOptions,
): Promise<ClassifyResult<T>> {
  const client = getClient();
  const model = getModel();
  const threshold =
    options?.confidenceThreshold ?? getDefaultConfidenceThreshold();

  const instructions =
    options?.instructions ??
    "Which of the following categories best describes this input?";

  const criteria: Record<string, string | null> = Array.isArray(categories)
    ? Object.fromEntries(categories.map((c) => [c, null]))
    : (Object.fromEntries(
        Object.entries(categories).map(([k, v]) => [k, v as string | null]),
      ) as Record<string, string | null>);

  try {
    const response = await client.systemOne({
      state: input,
      model,
      questions: {
        classification: choice(instructions, criteria),
      },
    });

    const answer = response.answers.classification;
    if (!answer || answer.type !== "choice") {
      throw new NoAnswerError("classification");
    }

    return {
      choice: answer.choice as T,
      confidence: answer.confidence,
      probabilities: answer.probabilities as Record<T, number>,
      isConfident: answer.confidence >= threshold,
    };
  } catch (error) {
    if (error instanceof NoAnswerError) throw error;
    throw new APICallError(
      `classify() failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error,
    );
  }
}
