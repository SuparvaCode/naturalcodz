import { describe, it, expect } from "vitest";
import {
  confidenceLevel,
  isConfident,
  NaturalCodzError,
  ConfigurationError,
  APICallError,
  NoAnswerError,
} from "../src/index.js";

describe("Confidence Utilities", () => {
  describe("confidenceLevel", () => {
    it("should return 'high' when confidence is >= highThreshold", () => {
      expect(confidenceLevel(0.8)).toBe("high");
      expect(confidenceLevel(0.95)).toBe("high");
      expect(confidenceLevel(1.0)).toBe("high");
    });

    it("should return 'low' when confidence is <= lowThreshold", () => {
      expect(confidenceLevel(0.4)).toBe("low");
      expect(confidenceLevel(0.2)).toBe("low");
      expect(confidenceLevel(0.0)).toBe("low");
    });

    it("should return 'medium' when confidence is between low and high", () => {
      expect(confidenceLevel(0.5)).toBe("medium");
      expect(confidenceLevel(0.79)).toBe("medium");
      expect(confidenceLevel(0.41)).toBe("medium");
    });

    it("should support custom thresholds", () => {
      expect(confidenceLevel(0.7, 0.9, 0.3)).toBe("medium");
      expect(confidenceLevel(0.92, 0.9, 0.3)).toBe("high");
      expect(confidenceLevel(0.25, 0.9, 0.3)).toBe("low");
    });
  });

  describe("isConfident", () => {
    it("should return true when confidence >= default threshold (0.6)", () => {
      expect(isConfident(0.6)).toBe(true);
      expect(isConfident(0.85)).toBe(true);
    });

    it("should return false when confidence < default threshold (0.6)", () => {
      expect(isConfident(0.59)).toBe(false);
      expect(isConfident(0.2)).toBe(false);
    });

    it("should support custom threshold", () => {
      expect(isConfident(0.75, 0.8)).toBe(false);
      expect(isConfident(0.8, 0.8)).toBe(true);
    });
  });
});

describe("Error Classes", () => {
  it("NaturalCodzError should have correct name and message", () => {
    const err = new NaturalCodzError("test error");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(NaturalCodzError);
    expect(err.name).toBe("NaturalCodzError");
    expect(err.message).toBe("test error");
  });

  it("ConfigurationError should inherit from NaturalCodzError", () => {
    const err = new ConfigurationError("missing key");
    expect(err).toBeInstanceOf(NaturalCodzError);
    expect(err.name).toBe("ConfigurationError");
    expect(err.message).toBe("missing key");
  });

  it("APICallError should hold status code and cause", () => {
    const cause = new Error("Network timeout");
    const err = new APICallError("Request failed", 500, cause);
    expect(err).toBeInstanceOf(NaturalCodzError);
    expect(err.name).toBe("APICallError");
    expect(err.statusCode).toBe(500);
    expect(err.cause).toBe(cause);
    expect(err.message).toBe("Request failed");
  });

  it("NoAnswerError should format question id in message", () => {
    const err = new NoAnswerError("intent");
    expect(err).toBeInstanceOf(NaturalCodzError);
    expect(err.name).toBe("NoAnswerError");
    expect(err.message).toContain('No answer received for question "intent"');
  });
});
