import type {
  State,
  CategoryInput,
  ClassifyOptions,
  ClassifyResult,
  GuardResult,
  ScoreResult,
  CheckResult,
  CheckOptions,
  IsOptions,
  PickOptions,
  PickBestResult,
} from "../types.js";
import { check } from "../check/check.js";
import { contentFilter } from "../guard/contentFilter.js";
import { guard } from "../guard/guard.js";
import { pickBest } from "../extract/pickBest.js";
import { score } from "../score/score.js";
import { classify } from "../classify/classify.js";

/**
 * Ask any natural-language yes/no question about an input.
 *
 * Returns a simple `boolean` (`true` or `false`).
 *
 * @param input - The text or data to evaluate.
 * @param condition - The condition in plain English (e.g. "is angry", "asking for refund", "mentions pricing").
 * @param options - Optional cutoff threshold override (e.g. `{ threshold: 0.7 }`).
 *
 * @example
 * ```ts
 * if (await is(comment, "angry")) {
 *   escalateToSupport(comment);
 * }
 *
 * // Stricter cutoff:
 * if (await is(email, "asking for a refund", { threshold: 0.8 })) {
 *   openRefundTicket(email);
 * }
 * ```
 */
export async function is(
  input: State,
  condition: string,
  options?: IsOptions,
): Promise<boolean> {
  const result = await check(input, condition, options);
  return result.answer;
}

/**
 * Check the opposite of a condition.
 *
 * @example
 * ```ts
 * if (await is.not(message, "relevant to tech")) skip();
 * ```
 */
is.not = async function (
  input: State,
  condition: string,
  options?: IsOptions,
): Promise<boolean> {
  const answer = await is(input, condition, options);
  return !answer;
};

/**
 * Detailed check returning the raw probability and strong-signal indicator.
 */
is.detailed = async function (
  input: State,
  condition: string,
  options?: CheckOptions,
): Promise<CheckResult> {
  return check(input, condition, options);
};

/**
 * Quick safety check: returns `true` if content is safe, `false` if flagged.
 *
 * Checks against hate speech, harassment, spam, PII, self-harm, and illegal activity.
 *
 * @param input - The text or structured state to screen.
 * @param options - Optional threshold overrides (`blockThreshold`, `reviewThreshold`).
 *
 * @example
 * ```ts
 * if (!await isSafe(userComment)) {
 *   return "Message blocked by safety filters.";
 * }
 * ```
 */
export async function isSafe(
  input: State,
  options?: { blockThreshold?: number; reviewThreshold?: number },
): Promise<boolean> {
  const result = await contentFilter(input, options);
  return result.action === "pass";
}

/**
 * Quick check if content is promotional spam or advertising.
 *
 * @example
 * ```ts
 * if (await isSpam(message)) dropMessage();
 * ```
 */
export async function isSpam(input: State, options?: IsOptions): Promise<boolean> {
  return is(
    input,
    "Is this promotional spam, unsolicited advertising, or repetitive low-quality content?",
    options,
  );
}

/**
 * Quick check if content is toxic, insulting, or harassing.
 *
 * @example
 * ```ts
 * if (await isToxic(chatMessage)) warnUser();
 * ```
 */
export async function isToxic(input: State, options?: IsOptions): Promise<boolean> {
  return is(
    input,
    "Contains toxic language, hate speech, slurs, insults, or personal attacks?",
    options,
  );
}

/**
 * Quick check if content contains personally identifiable information (PII).
 *
 * @example
 * ```ts
 * if (await hasPII(bio)) alert("Please do not share personal contact details!");
 * ```
 */
export async function hasPII(input: State, options?: IsOptions): Promise<boolean> {
  return is(
    input,
    "Contains personally identifiable information such as phone numbers, emails, addresses, SSNs, or credit card numbers?",
    options,
  );
}

/**
 * Pick the best matching candidate directly as a string.
 *
 * @param input - The text or data context.
 * @param candidates - An array of options to choose from.
 * @param criteriaOrOptions - Optional criteria string or PickOptions object.
 * @returns The chosen string option directly.
 *
 * @example
 * ```ts
 * const department = await pick(ticket, ["billing", "engineering", "sales"]);
 * console.log(department); // "billing"
 * ```
 */
export async function pick<T extends string>(
  input: State,
  candidates: readonly T[] | T[],
  criteriaOrOptions?: string | PickOptions,
): Promise<T> {
  const criteria =
    typeof criteriaOrOptions === "string"
      ? criteriaOrOptions
      : criteriaOrOptions?.criteria ??
        "Which of the following options best matches or answers this input?";

  const result = await pickBest(input, candidates as T[], criteria);
  return result.choice;
}

/** Detailed candidate selection returning confidence and probability map. */
pick.detailed = async function <T extends string>(
  input: State,
  candidates: readonly T[] | T[],
  criteriaOrOptions?: string | PickOptions,
): Promise<PickBestResult<T>> {
  const criteria =
    typeof criteriaOrOptions === "string"
      ? criteriaOrOptions
      : criteriaOrOptions?.criteria ??
        "Which of the following options best matches or answers this input?";

  return pickBest(input, candidates as T[], criteria);
};

/**
 * Rate an input numerically (e.g. 1 to 5) or along an ordered list of labels.
 *
 * @example
 * ```ts
 * // 1 to 5 star rating:
 * const stars = await rate(review, 1, 5); // returns 1, 2, 3, 4, or 5
 *
 * // Ordered words:
 * const urgency = await rate(ticket, ["low", "medium", "high", "critical"]); // returns "high"
 * ```
 */
export async function rate(
  input: State,
  minOrRubric: number | string[],
  maxOrCriteria?: number | string,
  criteria?: string,
): Promise<number | string> {
  if (typeof minOrRubric === "number") {
    const min = minOrRubric;
    const max = typeof maxOrCriteria === "number" ? maxOrCriteria : 5;
    const instruction =
      typeof criteria === "string"
        ? criteria
        : "Rate this input on the numerical scale from lowest to highest:";

    const rubric: string[] = [];
    for (let i = min; i <= max; i++) {
      rubric.push(`${i} out of ${max}`);
    }

    const res = await score(input, rubric, instruction);
    const offset = Math.round(res.score);
    return Math.min(Math.max(min + offset, min), max);
  }

  // String rubric
  const rubric = minOrRubric;
  const instruction =
    typeof maxOrCriteria === "string"
      ? maxOrCriteria
      : "Score this input against the ordered levels:";

  const res = await score(input, rubric, instruction);
  return res.label;
}

/**
 * Fluent natural logic wrapper for an input.
 *
 * Enables natural chaining like:
 * ```ts
 * if (await natural(text).is("urgent")) ...
 * const action = await natural(text).pick(["refund", "cancel", "help"]);
 * ```
 */
export function natural(input: State) {
  return {
    /** True/false condition check with optional threshold */
    is: (condition: string, options?: IsOptions) => is(input, condition, options),
    /** Opposite condition check */
    isNot: (condition: string, options?: IsOptions) => is.not(input, condition, options),
    /** Check detailed probability */
    check: (condition: string, options?: CheckOptions) => check(input, condition, options),
    /** Content safety check */
    isSafe: (options?: { blockThreshold?: number; reviewThreshold?: number }) => isSafe(input, options),
    /** Spam check */
    isSpam: (options?: IsOptions) => isSpam(input, options),
    /** Toxicity check */
    isToxic: (options?: IsOptions) => isToxic(input, options),
    /** PII check */
    hasPII: (options?: IsOptions) => hasPII(input, options),
    /** Pick best option from list */
    pick: <T extends string>(candidates: readonly T[] | T[], criteriaOrOptions?: string | PickOptions) =>
      pick(input, candidates, criteriaOrOptions),
    /** Rate 1 to 5 or against rubric */
    rate: (minOrRubric: number | string[], maxOrCriteria?: number | string, criteria?: string) =>
      rate(input, minOrRubric as any, maxOrCriteria as any, criteria),
    /** Classify into categories */
    classify: <T extends string>(categories: CategoryInput<T>, options?: ClassifyOptions) =>
      classify(input, categories, options),
    /** Guard screening */
    guard: (rules: Parameters<typeof guard>[1], thresholds?: Parameters<typeof guard>[2]) =>
      guard(input, rules, thresholds),
    /** Score against rubric */
    score: (rubric: Parameters<typeof score>[1], instructions?: string) =>
      score(input, rubric, instructions),
  };
}

/** Shorthand alias for `natural()`. */
export const n = natural;
