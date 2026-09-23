
import type { GuardResult, State } from "../types.js";
import { getThresholds } from "../client.js";
import { guard } from "./guard.js";

/**
 * Pre-configured content safety filter with common hazard categories.
 *
 * A convenience wrapper around `guard()` with sensible defaults for:
 * - Hate speech / toxicity
 * - Spam / promotional content
 * - PII (personally identifiable information)
 * - Self-harm / violence
 * - Sexual content
 *
 * @param input - The text or structured state to screen.
 * @param options - Optional threshold overrides.
 *
 * @example
 * ```ts
 * const result = await contentFilter(userMessage);
 * if (result.action !== "pass") {
 *   console.log("Blocked by:", result.triggered);
 * }
 * ```
 */
export async function contentFilter(
  input: State,
  options?: { blockThreshold?: number; reviewThreshold?: number },
): Promise<GuardResult> {
  const activeThresholds = getThresholds();
  return guard(input, {
    rules: {
      hate_speech:
        "Contains hate speech, slurs, discriminatory language, or personal attacks targeting protected groups",
      spam: "Is promotional spam, unsolicited advertising, or repetitive low-quality content",
      pii: "Contains personally identifiable information such as social security numbers, credit card numbers, passwords, or full addresses",
      self_harm:
        "Contains content promoting, encouraging, or depicting self-harm or violence",
      sexual_content:
        "Contains sexually explicit or inappropriate content",
      illegal_activity:
        "Promotes or provides instructions for illegal activities",
    },
    thresholds: {
      block: options?.blockThreshold ?? activeThresholds.guardBlock,
      review: options?.reviewThreshold ?? activeThresholds.guardReview,
    },
  });
}
