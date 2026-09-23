import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { check, checkAll, validate, APICallError, NoAnswerError } from "../src/index.js";

describe("check()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should evaluate single condition with answer and isStrong flags", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        condition: { type: "noul", noul: 0.92 },
      },
    } as any);

    const result = await check("Production database is unresponsive", "Is this urgent?");
    expect(result.probability).toBe(0.92);
    expect(result.answer).toBe(true);
    expect(result.isStrong).toBe(true);
  });

  it("should return answer=false when probability <= 0.5", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        condition: { type: "noul", noul: 0.25 },
      },
    } as any);

    const result = await check("Where can I find docs?", "Is this urgent?");
    expect(result.probability).toBe(0.25);
    expect(result.answer).toBe(false);
    expect(result.isStrong).toBe(false);
  });

  it("should throw NoAnswerError if answer missing", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {},
    } as any);

    await expect(check("text", "question")).rejects.toThrow(NoAnswerError);
  });
});

describe("checkAll()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should evaluate multiple conditions in parallel", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        urgent: { type: "noul", noul: 0.95 },
        refund: { type: "noul", noul: 0.1 },
        angry: { type: "noul", noul: 0.65 },
      },
    } as any);

    const results = await checkAll("Fix this bug immediately!", {
      urgent: "Is this urgent?",
      refund: "Is customer asking for money back?",
      angry: "Is customer frustrated or angry?",
    });

    expect(results.urgent.probability).toBe(0.95);
    expect(results.urgent.answer).toBe(true);
    expect(results.urgent.isStrong).toBe(true);

    expect(results.refund.probability).toBe(0.1);
    expect(results.refund.answer).toBe(false);
    expect(results.refund.isStrong).toBe(false);

    expect(results.angry.probability).toBe(0.65);
    expect(results.angry.answer).toBe(true);
    expect(results.angry.isStrong).toBe(false); // <= 0.8
  });
});

describe("validate()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should pass when all rules meet thresholds", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        polite: { type: "noul", noul: 0.9 },
        concise: { type: "noul", noul: 0.8 },
      },
    } as any);

    const result = await validate("Thanks for the swift update, much appreciated!", [
      { id: "polite", rule: "Is polite and respectful", threshold: 0.5 },
      { id: "concise", rule: "Is under 3 sentences", threshold: 0.6 },
    ]);

    expect(result.valid).toBe(true);
    expect(result.passed).toEqual(["polite", "concise"]);
    expect(result.failed).toEqual([]);
    expect(result.details.polite).toBe(0.9);
  });

  it("should fail when any rule is below threshold", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        polite: { type: "noul", noul: 0.9 },
        no_pii: { type: "noul", noul: 0.3 },
      },
    } as any);

    const result = await validate("My email is test@example.com", [
      { id: "polite", rule: "Is polite" },
      { id: "no_pii", rule: "Does not contain personal contact information", threshold: 0.7 },
    ]);

    expect(result.valid).toBe(false);
    expect(result.passed).toContain("polite");
    expect(result.failed).toContain("no_pii");
    expect(result.details.no_pii).toBe(0.3);
  });
});
