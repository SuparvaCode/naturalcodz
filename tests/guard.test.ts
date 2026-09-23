import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { guard, contentFilter, APICallError } from "../src/index.js";

describe("guard()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return pass when all rule probabilities are below review threshold", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        toxic: { type: "noul", noul: 0.05 },
        spam: { type: "noul", noul: 0.12 },
      },
    } as any);

    const result = await guard("Hello, I need help with my account", {
      rules: {
        toxic: "Hate speech or personal attacks",
        spam: "Promotional spam",
      },
      thresholds: { block: 0.85, review: 0.5 },
    });

    expect(result.action).toBe("pass");
    expect(result.triggered).toEqual([]);
    expect(result.details.toxic).toBe(0.05);
    expect(result.details.spam).toBe(0.12);
  });

  it("should return review when probability is >= review but < block", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        toxic: { type: "noul", noul: 0.65 },
        spam: { type: "noul", noul: 0.05 },
      },
    } as any);

    const result = await guard("Your product is terrible and your team is annoying", {
      rules: {
        toxic: "Hate speech or personal attacks",
        spam: "Promotional spam",
      },
      thresholds: { block: 0.85, review: 0.5 },
    });

    expect(result.action).toBe("review");
    expect(result.triggered).toContain("toxic");
    expect(result.details.toxic).toBe(0.65);
  });

  it("should return block when any probability is >= block threshold", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        toxic: { type: "noul", noul: 0.92 },
        spam: { type: "noul", noul: 0.02 },
      },
    } as any);

    const result = await guard("Severe attack content", {
      rules: {
        toxic: "Hate speech or personal attacks",
        spam: "Promotional spam",
      },
      thresholds: { block: 0.85, review: 0.5 },
    });

    expect(result.action).toBe("block");
    expect(result.triggered).toContain("toxic");
  });

  it("should wrap API failures into APICallError", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockRejectedValueOnce(
      new Error("Server error")
    );

    await expect(
      guard("test", { rules: { r1: "rule 1" } })
    ).rejects.toThrow(APICallError);
  });
});

describe("contentFilter()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should screen using standard content safety categories", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        hate_speech: { type: "noul", noul: 0.01 },
        spam: { type: "noul", noul: 0.95 },
        pii: { type: "noul", noul: 0.02 },
        self_harm: { type: "noul", noul: 0.0 },
        sexual_content: { type: "noul", noul: 0.0 },
        illegal_activity: { type: "noul", noul: 0.01 },
      },
    } as any);

    const result = await contentFilter("BUY CHEAP PILLS NOW http://spam.xyz");

    expect(result.action).toBe("block");
    expect(result.triggered).toContain("spam");
    expect(result.details.spam).toBe(0.95);
  });
});
