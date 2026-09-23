export {
  is,
  isSafe,
  isSpam,
  isToxic,
  hasPII,
  pick,
  rate,
  natural,
  n,
  natural as default,
} from "./simple/index.js";

export { configure, getConfig, getThresholds } from "./client.js";
export { createNatural } from "./createNatural.js";

export { classify, multiClassify } from "./classify/index.js";
export { guard, contentFilter } from "./guard/index.js";
export { route, createRouter } from "./route/index.js";
export { check, checkAll, validate } from "./check/index.js";
export { score, compositeScore } from "./score/index.js";
export { pickBest } from "./extract/index.js";

export { confidenceLevel, isConfident } from "./utils/index.js";
export {
  NaturalCodzError,
  ConfigurationError,
  APICallError,
  NoAnswerError,
} from "./utils/index.js";

export type {
  NaturalCodzConfig,
  NaturalCodzThresholds,
  CategoryMap,
  CategoryInput,
  ClassifyOptions,
  ClassifyResult,
  ClassifyDimension,
  MultiClassifyResult,
  IsOptions,
  CheckOptions,
  PickOptions,
  GuardConfig,
  GuardAction,
  GuardResult,
  RouteConfig,
  RouteResult,
  RouteHandler,
  IntentRouterConfig,
  CheckResult,
  CheckAllResult,
  ValidationRule,
  ValidateResult,
  ScoreConfig,
  ScoreResult,
  ScoreDimension,
  CompositeScoreResult,
  PickBestResult,
  State,
} from "./types.js";

export type { ConfidenceLevel } from "./utils/confidence.js";
