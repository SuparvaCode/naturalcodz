import { TypeSafeClient, choice, noul, score as jevScore } from "@typesafe-ai/sdk";
import type {
  NaturalCodzConfig,
  NaturalCodzThresholds,
  State,
  CategoryInput,
  ClassifyOptions,
  ClassifyResult,
  ClassifyDimension,
  MultiClassifyResult,
  GuardConfig,
  GuardResult,
  GuardAction,
  RouteConfig,
  RouteResult,
  IntentRouterConfig,
  CheckOptions,
  CheckResult,
  CheckAllResult,
  ValidationRule,
  ValidateResult,
  ScoreConfig,
  ScoreResult,
  ScoreDimension,
  CompositeScoreResult,
  PickOptions,
  PickBestResult,
  IsOptions,
} from "./types.js";
import { APICallError, NoAnswerError } from "./utils/errors.js";

const DEFAULT_THRESHOLDS: Required<NaturalCodzThresholds> = {
  boolean: 0.5,
  strong: 0.8,
  confidence: 0.6,
  guardBlock: 0.85,
  guardReview: 0.5,
};

/**
 * Create an independent, scoped NaturalCodz instance with custom configuration.
 *
 * Useful for:
 * - Specifying custom API keys in TypeScript per-service or per-tenant
 * - Customizing accuracy thresholds (strict vs lenient)
 * - Using custom endpoints/proxies or specific Jev model versions
 *
 * @param initialConfig - Optional instance-specific configuration.
 *
 * @example
 * ```ts
 * import { createNatural } from 'naturalcodz';
 *
 * const ai = createNatural({
 *   apiKey: 'ts_...',
 *   model: 'jev-latest',
 *   thresholds: {
 *     boolean: 0.7, // Stricter cutoff
 *     confidence: 0.8, // Require 80% confidence
 *   },
 * });
 *
 * if (await ai.is(text, "angry")) { ... }
 * const dept = await ai.pick(ticket, ["billing", "tech", "sales"]);
 * ```
 */
export function createNatural(initialConfig: NaturalCodzConfig = {}) {
  let _config: NaturalCodzConfig = { ...initialConfig };
  let _client: TypeSafeClient | null = null;

  function getClient(): TypeSafeClient {
    if (!_client) {
      _client = new TypeSafeClient({
        ...(_config.apiKey ? { apiKey: _config.apiKey } : {}),
        ...(_config.baseUrl ? { baseUrl: _config.baseUrl } : {}),
      });
    }
    return _client;
  }

  function getModel(): string {
    return _config.model ?? "jev-latest";
  }

  function getThresholds(): Required<NaturalCodzThresholds> {
    const conf = _config.thresholds ?? {};
    return {
      boolean: conf.boolean ?? DEFAULT_THRESHOLDS.boolean,
      strong: conf.strong ?? DEFAULT_THRESHOLDS.strong,
      confidence:
        conf.confidence ??
        _config.defaultConfidenceThreshold ??
        DEFAULT_THRESHOLDS.confidence,
      guardBlock: conf.guardBlock ?? DEFAULT_THRESHOLDS.guardBlock,
      guardReview: conf.guardReview ?? DEFAULT_THRESHOLDS.guardReview,
    };
  }

  function configure(newConfig: NaturalCodzConfig): void {
    _config = {
      ..._config,
      ...newConfig,
      thresholds: {
        ..._config.thresholds,
        ...newConfig.thresholds,
      },
    };
    if (_client) _client = null;
  }

  // ── check() ─────────────────────────────────────────────────
  async function check(
    input: State,
    condition: string,
    options?: CheckOptions,
  ): Promise<CheckResult> {
    const client = getClient();
    const model = getModel();
    const th = getThresholds();
    const boolCutoff = options?.threshold ?? th.boolean;
    const strongCutoff = options?.strongThreshold ?? th.strong;

    try {
      const response = await client.systemOne({
        state: input,
        model,
        questions: { condition: noul(condition) },
      });
      const answer = response.answers.condition;
      if (!answer || answer.type !== "noul") throw new NoAnswerError("condition");
      const probability = answer.noul;
      return {
        probability,
        answer: probability > boolCutoff,
        isStrong: probability > strongCutoff,
      };
    } catch (error) {
      if (error instanceof NoAnswerError) throw error;
      throw new APICallError(`check() failed: ${error instanceof Error ? error.message : String(error)}`, undefined, error);
    }
  }

  // ── checkAll() ──────────────────────────────────────────────
  async function checkAll(
    input: State,
    conditions: Record<string, string>,
    options?: CheckOptions,
  ): Promise<CheckAllResult> {
    const client = getClient();
    const model = getModel();
    const th = getThresholds();
    const boolCutoff = options?.threshold ?? th.boolean;
    const strongCutoff = options?.strongThreshold ?? th.strong;

    const questions: Record<string, ReturnType<typeof noul>> = {};
    for (const [id, instruction] of Object.entries(conditions)) {
      questions[id] = noul(instruction);
    }

    try {
      const response = await client.systemOne({ state: input, model, questions });
      const results: CheckAllResult = {};
      for (const id of Object.keys(conditions)) {
        const answer = response.answers[id];
        const probability = answer && answer.type === "noul" ? answer.noul : 0;
        results[id] = {
          probability,
          answer: probability > boolCutoff,
          isStrong: probability > strongCutoff,
        };
      }
      return results;
    } catch (error) {
      throw new APICallError(`checkAll() failed: ${error instanceof Error ? error.message : String(error)}`, undefined, error);
    }
  }

  // ── is() ────────────────────────────────────────────────────
  async function isFn(input: State, condition: string, options?: IsOptions): Promise<boolean> {
    const res = await check(input, condition, options);
    return res.answer;
  }
  isFn.not = async function (input: State, condition: string, options?: IsOptions): Promise<boolean> {
    const res = await isFn(input, condition, options);
    return !res;
  };
  isFn.detailed = async function (input: State, condition: string, options?: CheckOptions): Promise<CheckResult> {
    return check(input, condition, options);
  };

  // ── classify() ──────────────────────────────────────────────
  async function classify<T extends string>(
    input: State,
    categories: CategoryInput<T>,
    options?: ClassifyOptions,
  ): Promise<ClassifyResult<T>> {
    const client = getClient();
    const model = getModel();
    const th = getThresholds();
    const threshold = options?.confidenceThreshold ?? th.confidence;
    const instructions = options?.instructions ?? "Which of the following categories best describes this input?";

    const criteria: Record<string, string | null> = Array.isArray(categories)
      ? Object.fromEntries(categories.map((c) => [c, null]))
      : (Object.fromEntries(Object.entries(categories).map(([k, v]) => [k, v as string | null])) as Record<string, string | null>);

    try {
      const response = await client.systemOne({
        state: input,
        model,
        questions: { classification: choice(instructions, criteria) },
      });
      const answer = response.answers.classification;
      if (!answer || answer.type !== "choice") throw new NoAnswerError("classification");
      return {
        choice: answer.choice as T,
        confidence: answer.confidence,
        probabilities: answer.probabilities as Record<T, number>,
        isConfident: answer.confidence >= threshold,
      };
    } catch (error) {
      if (error instanceof NoAnswerError) throw error;
      throw new APICallError(`classify() failed: ${error instanceof Error ? error.message : String(error)}`, undefined, error);
    }
  }

  // ── multiClassify() ─────────────────────────────────────────
  async function multiClassify(
    input: State,
    dimensions: Record<string, ClassifyDimension>,
  ): Promise<MultiClassifyResult> {
    const client = getClient();
    const model = getModel();
    const defaultThreshold = getThresholds().confidence;

    const questions: Record<string, ReturnType<typeof choice>> = {};
    for (const [dimId, dim] of Object.entries(dimensions)) {
      questions[dimId] = choice(dim.instructions, dim.categories);
    }

    try {
      const response = await client.systemOne({ state: input, model, questions });
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
      throw new APICallError(`multiClassify() failed: ${error instanceof Error ? error.message : String(error)}`, undefined, error);
    }
  }

  // ── guard() ─────────────────────────────────────────────────
  async function guard(
    input: State,
    rulesOrConfig: GuardConfig | string[],
    thresholds?: { block?: number; review?: number } | number,
  ): Promise<GuardResult> {
    const client = getClient();
    const model = getModel();
    const activeTh = getThresholds();

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
          block: block ?? activeTh.guardBlock,
          review: review ?? activeTh.guardReview,
        },
      };
    } else {
      config = rulesOrConfig;
    }

    const blockThreshold = config.thresholds?.block ?? activeTh.guardBlock;
    const reviewThreshold = config.thresholds?.review ?? activeTh.guardReview;

    const questions: Record<string, ReturnType<typeof noul>> = {};
    for (const [ruleId, instructions] of Object.entries(config.rules)) {
      questions[ruleId] = noul(instructions);
    }

    try {
      const response = await client.systemOne({ state: input, model, questions });
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
      throw new APICallError(`guard() failed: ${error instanceof Error ? error.message : String(error)}`, undefined, error);
    }
  }

  // ── contentFilter() ─────────────────────────────────────────
  async function contentFilter(
    input: State,
    options?: { blockThreshold?: number; reviewThreshold?: number },
  ): Promise<GuardResult> {
    const activeTh = getThresholds();
    return guard(input, {
      rules: {
        hate_speech: "Contains hate speech, slurs, discriminatory language, or personal attacks targeting protected groups",
        spam: "Is promotional spam, unsolicited advertising, or repetitive low-quality content",
        pii: "Contains personally identifiable information such as social security numbers, credit card numbers, passwords, or full addresses",
        self_harm: "Contains content promoting, encouraging, or depicting self-harm or violence",
        sexual_content: "Contains sexually explicit or inappropriate content",
        illegal_activity: "Promotes or provides instructions for illegal activities",
      },
      thresholds: {
        block: options?.blockThreshold ?? activeTh.guardBlock,
        review: options?.reviewThreshold ?? activeTh.guardReview,
      },
    });
  }

  // ── pickBest() & pick() ─────────────────────────────────────
  async function pickBest<T extends string>(
    context: State,
    candidates: T[],
    criteria: string,
  ): Promise<PickBestResult<T>> {
    const client = getClient();
    const model = getModel();
    const choiceCriteria: Record<string, null> = {};
    for (const c of candidates) choiceCriteria[c] = null;

    try {
      const response = await client.systemOne({
        state: context,
        model,
        questions: { best: choice(criteria, choiceCriteria) },
      });
      const answer = response.answers.best;
      if (!answer || answer.type !== "choice") throw new NoAnswerError("best");
      return {
        choice: answer.choice as T,
        confidence: answer.confidence,
        probabilities: answer.probabilities as Record<T, number>,
      };
    } catch (error) {
      if (error instanceof NoAnswerError) throw error;
      throw new APICallError(`pickBest() failed: ${error instanceof Error ? error.message : String(error)}`, undefined, error);
    }
  }

  async function pick<T extends string>(
    input: State,
    candidates: readonly T[] | T[],
    criteriaOrOptions?: string | PickOptions,
  ): Promise<T> {
    const criteria =
      typeof criteriaOrOptions === "string"
        ? criteriaOrOptions
        : criteriaOrOptions?.criteria ?? "Which of the following options best matches or answers this input?";
    const res = await pickBest(input, candidates as T[], criteria);
    return res.choice;
  }
  pick.detailed = async function <T extends string>(
    input: State,
    candidates: readonly T[] | T[],
    criteriaOrOptions?: string | PickOptions,
  ): Promise<PickBestResult<T>> {
    const criteria =
      typeof criteriaOrOptions === "string"
        ? criteriaOrOptions
        : criteriaOrOptions?.criteria ?? "Which of the following options best matches or answers this input?";
    return pickBest(input, candidates as T[], criteria);
  };

  // ── score() ─────────────────────────────────────────────────
  async function score(
    input: State,
    rubricOrConfig: ScoreConfig | string[],
    instructions?: string,
  ): Promise<ScoreResult> {
    const client = getClient();
    const model = getModel();
    const config: ScoreConfig = Array.isArray(rubricOrConfig)
      ? { rubric: rubricOrConfig, instructions: instructions ?? "Evaluate and score this input against the given levels:" }
      : rubricOrConfig;

    try {
      const response = await client.systemOne({
        state: input,
        model,
        questions: { scoring: jevScore(config.instructions, config.rubric as [string, string, ...string[]]) },
      });
      const answer = response.answers.scoring;
      if (!answer || answer.type !== "score") throw new NoAnswerError("scoring");
      const maxLevel = config.rubric.length - 1;
      const normalized = maxLevel > 0 ? answer.score / maxLevel : 0;
      const levelIndex = Math.round(Math.min(Math.max(answer.score, 0), maxLevel));
      const label = config.rubric[levelIndex] ?? config.rubric[0]!;
      return {
        score: answer.score,
        label,
        confidence: answer.confidence,
        normalized,
        probabilities: answer.probabilities as Record<string, number>,
        legend: answer.legend as Record<string, string>,
      };
    } catch (error) {
      if (error instanceof NoAnswerError) throw error;
      throw new APICallError(`score() failed: ${error instanceof Error ? error.message : String(error)}`, undefined, error);
    }
  }

  // ── rate() ──────────────────────────────────────────────────
  async function rate(
    input: State,
    minOrRubric: number | string[],
    maxOrCriteria?: number | string,
    criteria?: string,
  ): Promise<number | string> {
    if (typeof minOrRubric === "number") {
      const min = minOrRubric;
      const max = typeof maxOrCriteria === "number" ? maxOrCriteria : 5;
      const instruction = typeof criteria === "string" ? criteria : "Rate this input on the numerical scale from lowest to highest:";
      const rubric: string[] = [];
      for (let i = min; i <= max; i++) rubric.push(`${i} out of ${max}`);
      const res = await score(input, rubric, instruction);
      const offset = Math.round(res.score);
      return Math.min(Math.max(min + offset, min), max);
    }
    const rubric = minOrRubric;
    const instruction = typeof maxOrCriteria === "string" ? maxOrCriteria : "Score this input against the ordered levels:";
    const res = await score(input, rubric, instruction);
    return res.label;
  }

  // ── Safety one-liners ───────────────────────────────────────
  async function isSafe(input: State, options?: { blockThreshold?: number; reviewThreshold?: number }): Promise<boolean> {
    const res = await contentFilter(input, options);
    return res.action === "pass";
  }

  async function isSpam(input: State, options?: IsOptions): Promise<boolean> {
    return isFn(input, "Is this promotional spam, unsolicited advertising, or repetitive low-quality content?", options);
  }

  async function isToxic(input: State, options?: IsOptions): Promise<boolean> {
    return isFn(input, "Contains toxic language, hate speech, slurs, insults, or personal attacks?", options);
  }

  async function hasPII(input: State, options?: IsOptions): Promise<boolean> {
    return isFn(input, "Contains personally identifiable information such as phone numbers, emails, addresses, SSNs, or credit card numbers?", options);
  }

  // ── fluent natural() ────────────────────────────────────────
  function natural(input: State) {
    return {
      is: (condition: string, options?: IsOptions) => isFn(input, condition, options),
      isNot: (condition: string, options?: IsOptions) => isFn.not(input, condition, options),
      check: (condition: string, options?: CheckOptions) => check(input, condition, options),
      isSafe: (options?: { blockThreshold?: number; reviewThreshold?: number }) => isSafe(input, options),
      isSpam: (options?: IsOptions) => isSpam(input, options),
      isToxic: (options?: IsOptions) => isToxic(input, options),
      hasPII: (options?: IsOptions) => hasPII(input, options),
      pick: <T extends string>(candidates: readonly T[] | T[], criteriaOrOptions?: string | PickOptions) =>
        pick(input, candidates, criteriaOrOptions),
      rate: (minOrRubric: number | string[], maxOrCriteria?: number | string, criteria?: string) =>
        rate(input, minOrRubric as any, maxOrCriteria as any, criteria),
      classify: <T extends string>(categories: CategoryInput<T>, options?: ClassifyOptions) =>
        classify(input, categories, options),
      guard: (rules: Parameters<typeof guard>[1], thresholds?: Parameters<typeof guard>[2]) =>
        guard(input, rules, thresholds),
      score: (rubric: Parameters<typeof score>[1], instructions?: string) =>
        score(input, rubric, instructions),
    };
  }

  return {
    // Configuration & Metadata
    configure,
    getConfig: () => _config,
    getThresholds,
    getClient,
    getModel,

    // Everyday Simple APIs
    is: isFn,
    isSafe,
    isSpam,
    isToxic,
    hasPII,
    pick,
    rate,
    natural,
    n: natural,

    // Core Modules
    classify,
    multiClassify,
    guard,
    contentFilter,
    check,
    checkAll,
    score,
    pickBest,
  };
}
