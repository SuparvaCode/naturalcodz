
/**
 * Confidence level buckets for human-readable thresholding.
 */
export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * Determine the confidence level given a confidence score.
 *
 * @param confidence - A value between 0 and 1.
 * @param highThreshold - Minimum for "high". Default: 0.8
 * @param lowThreshold - Maximum for "low". Default: 0.4
 */
export function confidenceLevel(
  confidence: number,
  highThreshold = 0.8,
  lowThreshold = 0.4,
): ConfidenceLevel {
  if (confidence >= highThreshold) return "high";
  if (confidence <= lowThreshold) return "low";
  return "medium";
}

/**
 * Check whether a confidence score meets a minimum threshold.
 */
export function isConfident(confidence: number, threshold = 0.6): boolean {
  return confidence >= threshold;
}
