
import { noul } from "@typesafe-ai/sdk";
import { getClient, getModel, getThresholds } from "../client.js";
import type { CheckOptions, CheckResult, CheckAllResult, State } from "../types.js";
import { APICallError, NoAnswerError } from "../utils/errors.js";

/**
 * Check whether a condition is true for the given input.
 *
 * Returns a probability-aware boolean — you get the raw probability
 * plus convenience flags for quick branching.
 *
 * Uses a single Jev Noul question.
 *
 * @param input - The text or structured state to evaluate.
 * @param condition - A natural-language condition or question.
 * @param options - Optional threshold overrides for `answer` and `isStrong`.
 * @returns A CheckResult with probability, answer, and isStrong.
 *
 * @example
 * ```ts
 * const urgent = await check(message, "Does this message express urgency?");
 * if (urgent.isStrong) escalate(message);
 * ```
 */
export async function check(
  input: State,
  condition: string,
  options?: CheckOptions,
): Promise<CheckResult> {
  const client = getClient();
  const model = getModel();
  const thresholds = getThresholds();
  const booleanCutoff = options?.threshold ?? thresholds.boolean;
  const strongCutoff = options?.strongThreshold ?? thresholds.strong;

  try {
    const response = await client.systemOne({
      state: input,
      model,
      questions: {
        condition: noul(condition),
      },
    });

    const answer = response.answers.condition;
    if (!answer || answer.type !== "noul") {
      throw new NoAnswerError("condition");
    }

    const probability = answer.noul;
    return {
      probability,
      answer: probability > booleanCutoff,
      isStrong: probability > strongCutoff,
    };
  } catch (error) {
    if (error instanceof NoAnswerError) throw error;
    throw new APICallError(
      `check() failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error,
    );
  }
}

/**
 * Check multiple conditions in a single API call.
 *
 * All conditions are evaluated as independent Noul questions in
 * parallel — adding conditions barely increases latency.
 *
 * @param input - The text or structured state to evaluate.
 * @param conditions - A map of condition IDs to natural-language conditions.
 * @returns A map of condition IDs to CheckResult objects.
 *
 * @example
 * ```ts
 * const checks = await checkAll(message, {
 *   urgent: "Does this message express urgency?",
 *   refund: "Is the customer requesting a refund?",
 *   escalation: "Should this be escalated to a manager?",
 * });
 * if (checks.urgent.isStrong && checks.escalation.answer) {
 *   escalateToManager(message);
 * }
 * ```
 */
export async function checkAll(
  input: State,
  conditions: Record<string, string>,
  options?: CheckOptions,
): Promise<CheckAllResult> {
  const client = getClient();
  const model = getModel();
  const thresholds = getThresholds();
  const booleanCutoff = options?.threshold ?? thresholds.boolean;
  const strongCutoff = options?.strongThreshold ?? thresholds.strong;

  const questions: Record<string, ReturnType<typeof noul>> = {};
  for (const [id, instruction] of Object.entries(conditions)) {
    questions[id] = noul(instruction);
  }

  try {
    const response = await client.systemOne({
      state: input,
      model,
      questions,
    });

    const results: CheckAllResult = {};
    for (const id of Object.keys(conditions)) {
      const answer = response.answers[id];
      const probability =
        answer && answer.type === "noul" ? answer.noul : 0;
      results[id] = {
        probability,
        answer: probability > booleanCutoff,
        isStrong: probability > strongCutoff,
      };
    }

    return results;
  } catch (error) {
    throw new APICallError(
      `checkAll() failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error,
    );
  }
}
