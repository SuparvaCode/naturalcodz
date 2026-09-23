
import { choice } from "@typesafe-ai/sdk";
import { getClient, getModel } from "../client.js";
import type { RouteConfig, RouteResult, State } from "../types.js";
import { APICallError, NoAnswerError } from "../utils/errors.js";

/**
 * Route an input to one of a set of destinations.
 *
 * Uses a Jev Choice question with confidence-gated fallback.
 * When confidence is below the threshold, the fallback destination
 * is used instead of the model's choice.
 *
 * @param input - The text or structured state to route.
 * @param config - Destination map, fallback, and threshold.
 * @returns A RouteResult with the chosen destination and metadata.
 *
 * @example
 * ```ts
 * const dest = await route(userInput, {
 *   destinations: {
 *     billing: "Payment, charges, invoices",
 *     technical: "Bugs, errors, API issues",
 *     sales: "Pricing, plans, enterprise",
 *     general: "Everything else",
 *   },
 *   fallback: "general",
 *   confidenceThreshold: 0.5,
 * });
 * handlers[dest.choice](userInput);
 * ```
 */
export async function route<T extends string>(
  input: State,
  config: RouteConfig & { destinations: Record<T, string | null> },
): Promise<RouteResult<T>> {
  const client = getClient();
  const model = getModel();
  const threshold = config.confidenceThreshold ?? 0.5;

  const instructions =
    config.instructions ??
    "Which of the following destinations best matches this input?";

  const criteria = Object.fromEntries(
    Object.entries(config.destinations).map(([k, v]) => [k, v]),
  ) as Record<string, string | null>;

  try {
    const response = await client.systemOne({
      state: input,
      model,
      questions: {
        routing: choice(instructions, criteria),
      },
    });

    const answer = response.answers.routing;
    if (!answer || answer.type !== "choice") {
      throw new NoAnswerError("routing");
    }

    const confident = answer.confidence >= threshold;
    const fallback = config.fallback as T | undefined;

    const finalChoice =
      confident || !fallback ? (answer.choice as T) : fallback;

    return {
      choice: finalChoice,
      confidence: answer.confidence,
      probabilities: answer.probabilities as Record<T, number>,
      usedFallback: !confident && !!fallback,
    };
  } catch (error) {
    if (error instanceof NoAnswerError) throw error;
    throw new APICallError(
      `route() failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      error,
    );
  }
}
