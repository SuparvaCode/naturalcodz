
/**
 * Base error class for all NaturalCodz errors.
 */
export class NaturalCodzError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NaturalCodzError";
  }
}

/**
 * Thrown when the NaturalCodz client is not configured properly.
 */
export class ConfigurationError extends NaturalCodzError {
  constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

/**
 * Thrown when an API call fails.
 */
export class APICallError extends NaturalCodzError {
  public readonly statusCode?: number;
  public readonly cause?: unknown;

  constructor(message: string, statusCode?: number, cause?: unknown) {
    super(message);
    this.name = "APICallError";
    this.statusCode = statusCode;
    this.cause = cause;
  }
}

/**
 * Thrown when no valid answer is found in the API response.
 */
export class NoAnswerError extends NaturalCodzError {
  constructor(questionId: string) {
    super(`No answer received for question "${questionId}"`);
    this.name = "NoAnswerError";
  }
}
