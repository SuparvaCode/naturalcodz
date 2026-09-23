import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { score, compositeScore, NoAnswerError } from "../src/index.js";

describe("score()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should calculate score, label, normalized value and confidence", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        scoring: {
          type: "score",
          score: 2.0,
          confidence: 0.9,
          probabilities: { "0": 0.05, "1": 0.05, "2": 0.85, "3": 0.05 },
          legend: { "0": "Low", "1": "Med", "2": "High", "3": "Crit" },
        },
      },
    } as any);

    const rubric = ["Low", "Med", "High", "Crit"];
    const result = await score("Major outage affecting users", {
      instructions: "How critical is this incident?",
      rubric,
    });

    expect(result.score).toBe(2.0);
    expect(result.label).toBe("High");
    expect(result.confidence).toBe(0.9);
    // 2 / (4 - 1) = 2 / 3 ≈ 0.6666
    expect(result.normalized).toBeCloseTo(0.6667, 3);
  });

  it("should throw NoAnswerError if scoring answer is missing", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {},
    } as any);

    await expect(
      score("test", { instructions: "test", rubric: ["A", "B"] })
    ).rejects.toThrow(NoAnswerError);
  });
});

describe("compositeScore()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should combine weighted normalized scores and compute minConfidence", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        severity: {
          type: "score",
          score: 3.0, // rubric max is 3 -> normalized = 1.0
          confidence: 0.92,
          probabilities: { "0": 0, "1": 0, "2": 0.1, "3": 0.9 },
          legend: {},
        },
        impact: {
          type: "score",
          score: 1.0, // rubric max is 2 -> normalized = 0.5
          confidence: 0.81,
          probabilities: { "0": 0.1, "1": 0.8, "2": 0.1 },
          legend: {},
        },
      },
    } as any);

    // severity: weight 0.6, impact: weight 0.4 -> total weight 1.0
    // weighted score = (1.0 * 0.6) + (0.5 * 0.4) = 0.6 + 0.2 = 0.8
    const result = await compositeScore("Critical bug", {
      severity: {
        weight: 0.6,
        rubric: ["Low", "Med", "High", "Critical"],
        instructions: "Rate severity",
      },
      impact: {
        weight: 0.4,
        rubric: ["Single user", "Team", "Entire company"],
        instructions: "Rate impact",
      },
    });

    expect(result.total).toBe(0.8);
    expect(result.minConfidence).toBe(0.81);
    expect(result.dimensions.severity.label).toBe("Critical");
    expect(result.dimensions.impact.label).toBe("Team");
  });
});
