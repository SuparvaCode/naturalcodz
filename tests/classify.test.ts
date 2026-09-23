import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { classify, multiClassify, NoAnswerError, APICallError } from "../src/index.js";

describe("classify()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return the chosen category with probabilities and confidence", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        classification: {
          type: "choice",
          choice: "cancellation",
          confidence: 0.88,
          probabilities: {
            cancellation: 0.88,
            refund: 0.08,
            billing: 0.04,
          },
        },
      },
    } as any);

    const result = await classify(
      "I want to cancel my account immediately",
      {
        cancellation: "User wants to terminate service",
        refund: "User wants payment returned",
        billing: "General billing question",
      },
      { confidenceThreshold: 0.7 }
    );

    expect(result.choice).toBe("cancellation");
    expect(result.confidence).toBe(0.88);
    expect(result.isConfident).toBe(true);
    expect(result.probabilities.cancellation).toBe(0.88);
    expect(result.probabilities.refund).toBe(0.08);
  });

  it("should mark isConfident as false when below threshold", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        classification: {
          type: "choice",
          choice: "billing",
          confidence: 0.52,
          probabilities: {
            billing: 0.52,
            refund: 0.48,
          },
        },
      },
    } as any);

    const result = await classify(
      "ambiguous text",
      {
        billing: "Billing query",
        refund: "Refund request",
      },
      { confidenceThreshold: 0.6 }
    );

    expect(result.choice).toBe("billing");
    expect(result.confidence).toBe(0.52);
    expect(result.isConfident).toBe(false);
  });

  it("should throw NoAnswerError if answer is missing or not a choice", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {},
    } as any);

    await expect(
      classify("some text", { a: "A", b: "B" })
    ).rejects.toThrow(NoAnswerError);
  });

  it("should wrap network / SDK errors into APICallError", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockRejectedValueOnce(
      new Error("Network connection lost")
    );

    await expect(
      classify("some text", { a: "A", b: "B" })
    ).rejects.toThrow(APICallError);
  });
});

describe("multiClassify()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should classify multiple dimensions in parallel", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        department: {
          type: "choice",
          choice: "tech",
          confidence: 0.95,
          probabilities: { tech: 0.95, billing: 0.05 },
        },
        urgency: {
          type: "choice",
          choice: "high",
          confidence: 0.85,
          probabilities: { high: 0.85, low: 0.15 },
        },
      },
    } as any);

    const result = await multiClassify("System is throwing 500 error", {
      department: {
        instructions: "Which department?",
        categories: { tech: "Technical issues", billing: "Billing issues" },
        confidenceThreshold: 0.8,
      },
      urgency: {
        instructions: "Urgency level?",
        categories: { high: "Critical/high", low: "Minor/low" },
        confidenceThreshold: 0.9,
      },
    });

    expect(result.department.choice).toBe("tech");
    expect(result.department.isConfident).toBe(true);
    expect(result.urgency.choice).toBe("high");
    expect(result.urgency.isConfident).toBe(false); // 0.85 < 0.9 threshold
  });
});
