import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { pickBest, NoAnswerError } from "../src/index.js";

describe("pickBest()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should select the best candidate based on criteria", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        best: {
          type: "choice",
          choice: "Stripe Docs",
          confidence: 0.95,
          probabilities: { "Stripe Docs": 0.95, "PayPal Docs": 0.05 },
        },
      },
    } as any);

    const candidates = ["Stripe Docs", "PayPal Docs"] as const;
    const result = await pickBest(
      "Payment gateway error 500",
      candidates as unknown as string[],
      "Which documentation is most relevant?"
    );

    expect(result.choice).toBe("Stripe Docs");
    expect(result.confidence).toBe(0.95);
    expect(result.probabilities["Stripe Docs"]).toBe(0.95);
  });

  it("should throw NoAnswerError when answer is missing", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {},
    } as any);

    await expect(
      pickBest("context", ["A", "B"], "criteria")
    ).rejects.toThrow(NoAnswerError);
  });
});
