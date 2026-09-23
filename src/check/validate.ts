
import { noul } from "@typesafe-ai/sdk";
import { getClient, getModel } from "../client.js";
import type { ValidationRule, ValidateResult, State } from "../types.js";
import { APICallError } from "../utils/errors.js";

/**
 * Validate an input against multiple subjective rules.
 *
 * Each rule becomes a Noul question. All rules are evaluated in
 * a single API call. A rule "passes" when its probability exceeds
 * its threshold (default 0.5).
 *
 * @param input - The text or structured state to validate.
 * @param rules - An array of validation rules.
 * @returns A ValidateResult with pass/fail for each rule.
 *
 * @example
 * ```ts
 * const result = await validate(userBio, [
 *   { id: "professional", rule: "Written in a professional tone" },
 *   { id: "no_contact", rule: "Does not contain personal contact info" },
 *   { id: "relevant", rule: "Relevant to a professional profile" },
 * ]);
 * if (!result.valid) console.log("Failed:", result.failed);
 * ```
 */
export async function validate(
  input: State,
  rules: ValidationRule[],
): Promise<ValidateResult> {
  const client = getClient();
  const model = getModel();

  const questions: Record<string, ReturnType<typeof noul>> = {};
  for (const r of rules) {
    questions[r.id] = noul(r.rule);
  }

  try {
    const response = await client.systemOne({
      state: input,
      model,
      questions,
    });

    const details: Record<string, number> = {};
    const passed: string[] = [];
    const failed: string[] = [];

    for (const r of rules) {
      const answer = response.answers[r.id];
      const prob = answer && answer.type === "noul" ? answer.noul : 0;
      details[r.id] = prob;

      const threshold = r.threshold ?? 0.5;
      if (prob >= threshold) {
        passed.push(r.id);
      } else {
        failed.push(r.id);
      }
    }

    return {
      valid: failed.length === 0,
      passed,
      failed,
      details,
    };
  } catch (error) {
    throw new APICallError(
      `validate() failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error,
    );
  }
}
