
/**
 * Global threshold settings for fine-tuning decision accuracy.
 */
export interface NaturalCodzThresholds {
  /**
   * Probability cutoff for boolean decisions (is, check, isSpam, isToxic, hasPII).
   * Range: 0.0 - 1.0. Default: 0.5
   */
  boolean?: number;
  /**
   * Probability cutoff for strong-signal confidence flag (check.isStrong).
   * Range: 0.0 - 1.0. Default: 0.8
   */
  strong?: number;
  /**
   * Confidence cutoff for trusting choices (classify, route, pick).
   * Range: 0.0 - 1.0. Default: 0.6
   */
  confidence?: number;
  /**
   * Probability cutoff above which guard() recommends "block".
   * Range: 0.0 - 1.0. Default: 0.85
   */
  guardBlock?: number;
  /**
   * Probability cutoff above which guard() recommends "review".
   * Range: 0.0 - 1.0. Default: 0.5
   */
  guardReview?: number;
}

/**
 * Configuration options for the NaturalCodz client or instance.
 */
export interface NaturalCodzConfig {
  /** TypeSafe / Jev API key. Falls back to TYPESAFE_API_KEY environment variable. */
  apiKey?: string;
  /** Jev model identifier. Defaults to "jev-latest". */
  model?: string;
  /** Base URL for custom endpoints or proxy gateways. */
  baseUrl?: string;
  /** Custom thresholds for accuracy adjustments across all functions. */
  thresholds?: NaturalCodzThresholds;
  /** Legacy alias for thresholds.confidence */
  defaultConfidenceThreshold?: number;
}

/** Options for is() and related boolean checks. */
export interface IsOptions {
  /** Custom probability threshold cutoff (overrides default 0.5). */
  threshold?: number;
}

/** Options for check(). */
export interface CheckOptions {
  /** Custom probability threshold for answer = true (default: 0.5). */
  threshold?: number;
  /** Custom probability threshold for isStrong = true (default: 0.8). */
  strongThreshold?: number;
}

/** Options for pick(). */
export interface PickOptions {
  /** Custom instruction or question for selecting best candidate. */
  criteria?: string;
  /** Minimum confidence threshold. */
  confidenceThreshold?: number;
}

// ─── Classify ───────────────────────────────────────────────

/** A map of category IDs to their descriptions. */
export type CategoryMap = Record<string, string | null>;

/** Categories input: either a map of { id: description } or a simple array of strings ['a', 'b', 'c'] */
export type CategoryInput<T extends string = string> =
  | Record<T, string | null>
  | readonly T[]
  | T[];

/** Options for classify(). */
export interface ClassifyOptions {
  /** Custom instructions for the classification question. */
  instructions?: string;
  /** Confidence threshold for isConfident flag. Default: 0.6 */
  confidenceThreshold?: number;
}

/** Result of a classify() call. */
export interface ClassifyResult<T extends string = string> {
  /** The selected category. */
  choice: T;
  /** Confidence score (0–1). */
  confidence: number;
  /** Probability distribution across all categories. */
  probabilities: Record<T, number>;
  /** Whether confidence exceeds the threshold. */
  isConfident: boolean;
}

/** A single classification dimension for multiClassify(). */
export interface ClassifyDimension {
  instructions: string;
  categories: CategoryMap;
  confidenceThreshold?: number;
}

/** Result of multiClassify() — keyed by dimension ID. */
export type MultiClassifyResult = Record<string, ClassifyResult>;

// ─── Guard ──────────────────────────────────────────────────

/** Configuration for guard(). */
export interface GuardConfig {
  /** Map of rule IDs to their descriptions (used as Noul instructions). */
  rules: Record<string, string>;
  /** Thresholds determining pass/review/block behavior. */
  thresholds?: {
    /** Noul probability above which the input is blocked. Default: 0.85 */
    block?: number;
    /** Noul probability above which the input is flagged for review. Default: 0.5 */
    review?: number;
  };
}

/** The action recommended by the guard. */
export type GuardAction = "pass" | "review" | "block";

/** Result of a guard() call. */
export interface GuardResult {
  /** Recommended action based on thresholds. */
  action: GuardAction;
  /** Rule IDs that triggered the action. */
  triggered: string[];
  /** Noul probability for every rule. */
  details: Record<string, number>;
}

// ─── Route ──────────────────────────────────────────────────

/** Configuration for route(). */
export interface RouteConfig {
  /** Map of destination IDs to their descriptions. */
  destinations: Record<string, string | null>;
  /** Fallback destination when confidence is below threshold. */
  fallback?: string;
  /** Confidence threshold for trusting the route. Default: 0.5 */
  confidenceThreshold?: number;
  /** Custom instructions for the routing question. */
  instructions?: string;
}

/** Result of a route() call. */
export interface RouteResult<T extends string = string> {
  /** The chosen destination. */
  choice: T;
  /** Confidence score (0–1). */
  confidence: number;
  /** Probability distribution across all destinations. */
  probabilities: Record<T, number>;
  /** Whether the fallback destination was used. */
  usedFallback: boolean;
}

/** Handler function for an intent router. */
export type RouteHandler<TContext = unknown, TResult = unknown> = (
  input: string,
  context?: TContext,
) => TResult | Promise<TResult>;

/** Configuration for createRouter(). */
export interface IntentRouterConfig<TContext = unknown, TResult = unknown> {
  /** Map of intent IDs to their descriptions. */
  intents: Record<string, string>;
  /** Map of intent IDs to handler functions. */
  handlers: Record<string, RouteHandler<TContext, TResult>>;
  /** Fallback handler when confidence is low. */
  fallbackHandler?: RouteHandler<TContext, TResult>;
  /** Confidence threshold. Default: 0.5 */
  confidenceThreshold?: number;
  /** Custom instructions for the routing question. */
  instructions?: string;
}

// ─── Check ──────────────────────────────────────────────────

/** Result of a check() call. */
export interface CheckResult {
  /** The noul probability (0–1). */
  probability: number;
  /** Whether probability > 0.5 (likely true). */
  answer: boolean;
  /** Whether probability > 0.8 (strong signal). */
  isStrong: boolean;
}

/** Result of checkAll() — keyed by condition ID. */
export type CheckAllResult = Record<string, CheckResult>;

/** A validation rule for validate(). */
export interface ValidationRule {
  /** Unique ID for this rule. */
  id: string;
  /** The condition to check (used as Noul instructions). */
  rule: string;
  /** Minimum probability threshold to consider this rule passed. Default: 0.5 */
  threshold?: number;
}

/** Result of validate(). */
export interface ValidateResult {
  /** Whether all rules passed. */
  valid: boolean;
  /** IDs of rules that passed. */
  passed: string[];
  /** IDs of rules that failed. */
  failed: string[];
  /** Noul probability for each rule. */
  details: Record<string, number>;
}

// ─── Score ───────────────────────────────────────────────────

/** Configuration for score(). */
export interface ScoreConfig {
  /** Ordered list of levels from lowest to highest. */
  rubric: string[];
  /** The scoring question/instructions. */
  instructions: string;
}

/** Result of a score() call. */
export interface ScoreResult {
  /** The raw score (0-indexed level). */
  score: number;
  /** The label of the matched level. */
  label: string;
  /** Confidence (0–1). */
  confidence: number;
  /** Score normalized to 0–1 range. */
  normalized: number;
  /** Probability distribution across all levels. */
  probabilities: Record<string, number>;
  /** Legend mapping level numbers to descriptions. */
  legend: Record<string, string>;
}

/** A single scoring dimension for compositeScore(). */
export interface ScoreDimension {
  /** Weight of this dimension (will be normalized). */
  weight: number;
  /** Ordered list of levels. */
  rubric: string[];
  /** The scoring question/instructions. */
  instructions: string;
}

/** Result of compositeScore(). */
export interface CompositeScoreResult {
  /** Weighted composite score (0–1). */
  total: number;
  /** Individual dimension results keyed by dimension ID. */
  dimensions: Record<string, ScoreResult & { weight: number }>;
  /** Lowest confidence across all dimensions. */
  minConfidence: number;
}

// ─── Extract ────────────────────────────────────────────────

/** Result of pickBest(). */
export interface PickBestResult<T extends string = string> {
  /** The chosen candidate. */
  choice: T;
  /** Confidence (0–1). */
  confidence: number;
  /** Probability distribution across all candidates. */
  probabilities: Record<T, number>;
}

// ─── State (input) ──────────────────────────────────────────

/** A JSON-compatible value (mirrors the SDK's JsonValue). */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Any value accepted as state for the TypeSafe API. */
export type State = string | { [key: string]: JsonValue } | JsonValue[] | null;
