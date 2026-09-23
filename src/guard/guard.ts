
import { noul } from "@typesafe-ai/sdk";
import { getClient, getModel, getThresholds } from "../client.js";
import type { GuardConfig, GuardResult, GuardAction, State } from "../types.js";
import { APICallError } from "../utils/errors.js";

/**
 * Screen an input against a set of safety rules, returning
 * a pass / review / block recommendation.
 *
 * Accepts either:
 * - A simple array of rules/hazards: `["toxic", "spam", "contains vulgar language"]`
 * - A full GuardConfig object: `{ rules: { ... }, thresholds: { ... } }`
 *
 * @param input - The text or structured state to screen.
 * @param rulesOrConfig - Array of rules/hazards or full GuardConfig object.
 * @param thresholds - Optional threshold overrides when passing an array.
 * @returns A GuardResult with the recommended action, triggered rules, and details.
 *
 * @example
 * ```ts
 * // Simple array form:
 * const result = await guard(userMessage, ["toxic content", "promotional spam"]);
 * if (result.action === "block") denyRequest();
 * ```
 */
export async function guard(
  input: State,
  rulesOrConfig: GuardConfig | string[],
  thresholds?: { block?: number; review?: number } | number,
): Promise<GuardResult> {
  const client = getClient();
  const model = getModel();
  const activeThresholds = getThresholds();
  const defaultBlock = activeThresholds.guardBlock;
  const defaultReview = activeThresholds.guardReview;

  let config: GuardConfig;
  if (Array.isArray(rulesOrConfig)) {
    const rules: Record<string, string> = {};
    for (let i = 0; i < rulesOrConfig.length; i++) {
      const item = rulesOrConfig[i]!;
      const key = item.includes(" ") ? `rule_${i + 1}` : item;
      rules[key] = item;
    }
    const block = typeof thresholds === "number" ? thresholds : thresholds?.block;
    const review = typeof thresholds === "object" ? thresholds?.review : undefined;
    config = {
      rules,
      thresholds: {
        block: block ?? defaultBlock,
        review: review ?? defaultReview,
      },
    };
  } else {
    config = rulesOrConfig;
  }

  const blockThreshold = config.thresholds?.block ?? defaultBlock;
  const reviewThreshold = config.thresholds?.review ?? defaultReview;

  // Build one Noul question per rule.
  const questions: Record<string, ReturnType<typeof noul>> = {};
  for (const [ruleId, instructions] of Object.entries(config.rules)) {
    questions[ruleId] = noul(instructions);
  }

  try {
    const response = await client.systemOne({
      state: input,
      model,
      questions,
    });

    const details: Record<string, number> = {};
    const triggered: string[] = [];
    let action: GuardAction = "pass";

    for (const ruleId of Object.keys(config.rules)) {
      const answer = response.answers[ruleId];
      const prob = answer && answer.type === "noul" ? answer.noul : 0;
      details[ruleId] = prob;

      if (prob >= blockThreshold) {
        triggered.push(ruleId);
        action = "block";
      } else if (prob >= reviewThreshold && action !== "block") {
        triggered.push(ruleId);
        action = "review";
      }
    }

    return { action, triggered, details };
  } catch (error) {
    throw new APICallError(
      `guard() failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error,
    );
  }
}
