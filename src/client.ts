
import { TypeSafeClient } from "@typesafe-ai/sdk";
import type { NaturalCodzConfig, NaturalCodzThresholds } from "./types.js";

const DEFAULT_THRESHOLDS: Required<NaturalCodzThresholds> = {
  boolean: 0.5,
  strong: 0.8,
  confidence: 0.6,
  guardBlock: 0.85,
  guardReview: 0.5,
};

let _client: TypeSafeClient | null = null;
let _config: NaturalCodzConfig = {};

/**
 * Configure the global NaturalCodz settings.
 *
 * Call this once at startup (e.g. in your main file or server boot).
 * Reads `TYPESAFE_API_KEY` from the environment if no apiKey is passed.
 *
 * @example
 * ```ts
 * import { configure } from 'naturalcodz';
 *
 * configure({
 *   apiKey: 'ts_...',
 *   model: 'jev-latest',
 *   thresholds: {
 *     boolean: 0.65, // stricter yes/no decisions
 *     confidence: 0.75, // higher confidence requirement
 *     guardBlock: 0.8, // lower tolerance for dangerous content
 *   }
 * });
 * ```
 */
export function configure(config: NaturalCodzConfig): void {
  _config = {
    ..._config,
    ...config,
    thresholds: {
      ..._config.thresholds,
      ...config.thresholds,
    },
  };
  // Force recreation on next access so the new config is picked up.
  if (_client) {
    _client = null;
  }
}

/**
 * Get the current active configuration.
 */
export function getConfig(): Readonly<NaturalCodzConfig> {
  return _config;
}

/**
 * Get the active threshold settings with defaults filled in.
 */
export function getThresholds(): Required<NaturalCodzThresholds> {
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

/**
 * Get or create the shared TypeSafeClient singleton.
 * @internal
 */
export function getClient(): TypeSafeClient {
  if (!_client) {
    _client = new TypeSafeClient({
      ...(_config.apiKey ? { apiKey: _config.apiKey } : {}),
      ...(_config.baseUrl ? { baseUrl: _config.baseUrl } : {}),
    });
  }
  return _client;
}

/**
 * Get the model name to use in requests.
 * @internal
 */
export function getModel(): string {
  return _config.model ?? "jev-latest";
}

/**
 * Get the default confidence threshold.
 * @internal
 */
export function getDefaultConfidenceThreshold(): number {
  return getThresholds().confidence;
}
