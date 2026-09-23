
import { choice } from "@typesafe-ai/sdk";
import { getClient, getModel } from "../client.js";
import type { IntentRouterConfig, State } from "../types.js";
import { APICallError, NoAnswerError } from "../utils/errors.js";

/**
 * Create a reusable intent router that classifies input and
 * dispatches it to the matching handler function.
 *
 * @param config - Intents, handlers, and routing options.
 * @returns An async function that accepts input + optional context.
 *
 * @example
 * ```ts
 * const handleTicket = createRouter({
 *   intents: {
 *     refund: "Customer wants money back",
 *     bug: "Customer reports a bug",
 *     question: "Customer has a question",
 *   },
 *   handlers: {
 *     refund: (input) => processRefund(input),
 *     bug: (input) => fileBugReport(input),
 *     question: (input) => searchKnowledgeBase(input),
 *   },
 *   fallbackHandler: (input) => routeToHuman(input),
 * });
 *
 * const result = await handleTicket(customerMessage);
 * ```
 */
export function createRouter<TContext = unknown, TResult = unknown>(
  config: IntentRouterConfig<TContext, TResult>,
): (input: State, context?: TContext) => Promise<{
  intent: string;
  confidence: number;
  usedFallback: boolean;
  result: TResult;
}> {
  const threshold = config.confidenceThreshold ?? 0.5;
  const instructions =
    config.instructions ??
    "What is the user's intent in this message?";

  return async (input: State, context?: TContext) => {
    const client = getClient();
    const model = getModel();

    const criteria = config.intents as Record<string, string>;

    try {
      const response = await client.systemOne({
        state: input,
        model,
        questions: {
          intent: choice(instructions, criteria),
        },
      });

      const answer = response.answers.intent;
      if (!answer || answer.type !== "choice") {
        throw new NoAnswerError("intent");
      }

      const confident = answer.confidence >= threshold;
      const usedFallback = !confident && !!config.fallbackHandler;

      let result: TResult;
      if (usedFallback && config.fallbackHandler) {
        result = await config.fallbackHandler(
          typeof input === "string" ? input : JSON.stringify(input),
          context,
        );
      } else {
        const handler = config.handlers[answer.choice];
        if (!handler) {
          if (config.fallbackHandler) {
            result = await config.fallbackHandler(
              typeof input === "string" ? input : JSON.stringify(input),
              context,
            );
          } else {
            throw new APICallError(
              `No handler for intent "${answer.choice}" and no fallback configured`,
            );
          }
        } else {
          result = await handler(
            typeof input === "string" ? input : JSON.stringify(input),
            context,
          );
        }
      }

      return {
        intent: answer.choice,
        confidence: answer.confidence,
        usedFallback,
        result,
      };
    } catch (error) {
      if (error instanceof NoAnswerError || error instanceof APICallError)
        throw error;
      throw new APICallError(
        `createRouter() failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        error,
      );
    }
  };
}
