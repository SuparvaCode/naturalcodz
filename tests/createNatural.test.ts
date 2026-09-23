import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import {
  configure,
  getThresholds,
  getConfig,
  createNatural,
  is,
  check,
  guard,
} from "../src/index.js";

describe("Thresholds & Accuracy Configuration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    configure({
      apiKey: "test_key",
      thresholds: {
        boolean: 0.5,
        strong: 0.8,
        confidence: 0.6,
        guardBlock: 0.85,
        guardReview: 0.5,
      },
    });
  });

  it("should allow adjusting global boolean threshold", async () => {
    // Set stricter boolean threshold to 0.75
    configure({
      thresholds: { boolean: 0.75 },
    });
    expect(getThresholds().boolean).toBe(0.75);

    // Probability 0.65 would normally be true (> 0.5), but with 0.75 cutoff it becomes false
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      answers: { condition: { type: "noul", noul: 0.65 } },
    } as any);

    const answer = await is("Somewhat urgent message", "urgent");
    expect(answer).toBe(false); // 0.65 is not > 0.75
  });

  it("should support per-call threshold override", async () => {
    // Global threshold is 0.5
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      answers: { condition: { type: "noul", noul: 0.65 } },
    } as any);

    // Per-call override requiring 0.7
    const strictAnswer = await is("Somewhat urgent message", "urgent", { threshold: 0.7 });
    expect(strictAnswer).toBe(false);

    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      answers: { condition: { type: "noul", noul: 0.65 } },
    } as any);

    // Per-call override lenient at 0.6
    const lenientAnswer = await is("Somewhat urgent message", "urgent", { threshold: 0.6 });
    expect(lenientAnswer).toBe(true);
  });

  it("check() should respect custom boolean and strong thresholds", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      answers: { condition: { type: "noul", noul: 0.75 } },
    } as any);

    const res = await check("System warning", "urgent", {
      threshold: 0.6,
      strongThreshold: 0.7,
    });

    expect(res.probability).toBe(0.75);
    expect(res.answer).toBe(true); // 0.75 > 0.6
    expect(res.isStrong).toBe(true); // 0.75 > 0.7
  });

  it("guard() should respect global guardBlock and guardReview thresholds", async () => {
    configure({
      thresholds: {
        guardBlock: 0.7, // block earlier at 70%
        guardReview: 0.4, // review at 40%
      },
    });

    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      answers: {
        spam: { type: "noul", noul: 0.72 },
      },
    } as any);

    const res = await guard("Suspicious link", ["spam"]);
    expect(res.action).toBe("block"); // 0.72 > 0.70
  });
});

describe("createNatural() Scoped Instances", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should create independent instance with custom apiKey and thresholds", async () => {
    const customAi = createNatural({
      apiKey: "custom_tenant_key",
      model: "jev-custom",
      thresholds: {
        boolean: 0.8,
        confidence: 0.9,
      },
    });

    expect(customAi.getConfig().apiKey).toBe("custom_tenant_key");
    expect(customAi.getModel()).toBe("jev-custom");
    expect(customAi.getThresholds().boolean).toBe(0.8);
    expect(customAi.getThresholds().confidence).toBe(0.9);
  });

  it("instance methods should execute using instance configuration", async () => {
    const strictInstance = createNatural({
      apiKey: "strict_key",
      thresholds: { boolean: 0.8 },
    });

    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      answers: { condition: { type: "noul", noul: 0.75 } },
    } as any);

    const isTrue = await strictInstance.is("text", "condition");
    expect(isTrue).toBe(false); // 0.75 is not > 0.8

    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      answers: {
        best: {
          type: "choice",
          choice: "option_b",
          confidence: 0.92,
          probabilities: { option_b: 0.92 },
        },
      },
    } as any);

    const picked = await strictInstance.pick("test", ["option_a", "option_b"]);
    expect(picked).toBe("option_b");
  });

  it("instance configure() should dynamically update settings", () => {
    const ai = createNatural({ apiKey: "initial_key" });
    expect(ai.getConfig().apiKey).toBe("initial_key");

    ai.configure({ apiKey: "updated_key", thresholds: { boolean: 0.6 } });
    expect(ai.getConfig().apiKey).toBe("updated_key");
    expect(ai.getThresholds().boolean).toBe(0.6);
  });
});
