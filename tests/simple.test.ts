import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import natural, {
  is,
  isSafe,
  isSpam,
  isToxic,
  hasPII,
  pick,
  rate,
  n,
  classify,
  score,
  guard,
} from "../src/index.js";

describe("Simple Natural Primitives", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("is() and is.not()", () => {
    it("should return boolean true when answer is true", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: { condition: { type: "noul", noul: 0.88 } },
      } as any);

      const res = await is("Production database crashed!", "urgent");
      expect(res).toBe(true);
    });

    it("should return boolean false when answer is false", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: { condition: { type: "noul", noul: 0.12 } },
      } as any);

      const res = await is("Good morning team", "urgent");
      expect(res).toBe(false);
    });

    it("is.not should invert boolean", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: { condition: { type: "noul", noul: 0.15 } },
      } as any);

      const res = await is.not("Hello world", "spam");
      expect(res).toBe(true);
    });

    it("is.detailed should return probability and signal info", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: { condition: { type: "noul", noul: 0.95 } },
      } as any);

      const res = await is.detailed("Buy now!", "spam");
      expect(res.probability).toBe(0.95);
      expect(res.answer).toBe(true);
      expect(res.isStrong).toBe(true);
    });
  });

  describe("isSafe(), isSpam(), isToxic(), hasPII()", () => {
    it("isSafe should return true for benign content", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: {
          hate_speech: { type: "noul", noul: 0.01 },
          spam: { type: "noul", noul: 0.02 },
          pii: { type: "noul", noul: 0.01 },
          self_harm: { type: "noul", noul: 0.0 },
          sexual_content: { type: "noul", noul: 0.0 },
          illegal_activity: { type: "noul", noul: 0.01 },
        },
      } as any);

      expect(await isSafe("Hello, I need assistance")).toBe(true);
    });

    it("isSafe should return false for hazardous content", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: {
          hate_speech: { type: "noul", noul: 0.01 },
          spam: { type: "noul", noul: 0.95 },
          pii: { type: "noul", noul: 0.01 },
          self_harm: { type: "noul", noul: 0.0 },
          sexual_content: { type: "noul", noul: 0.0 },
          illegal_activity: { type: "noul", noul: 0.01 },
        },
      } as any);

      expect(await isSafe("CLICK HERE FOR FREE BITCOIN")).toBe(false);
    });

    it("isSpam should return true when spam detected", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: { condition: { type: "noul", noul: 0.92 } },
      } as any);

      expect(await isSpam("Free money now!!!")).toBe(true);
    });

    it("isToxic should return true when harassment detected", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: { condition: { type: "noul", noul: 0.89 } },
      } as any);

      expect(await isToxic("I hate you you idiot")).toBe(true);
    });

    it("hasPII should return true when personal info detected", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: { condition: { type: "noul", noul: 0.99 } },
      } as any);

      expect(await hasPII("My SSN is 123-45-6789")).toBe(true);
    });
  });

  describe("pick()", () => {
    it("should return the chosen candidate directly as a string", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: {
          best: {
            type: "choice",
            choice: "billing",
            confidence: 0.91,
            probabilities: { billing: 0.91, sales: 0.09 },
          },
        },
      } as any);

      const chosen = await pick("Where is my invoice?", ["billing", "sales"]);
      expect(chosen).toBe("billing");
    });
  });

  describe("rate()", () => {
    it("should rate numerical scale e.g. 1 to 5", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: {
          scoring: {
            type: "score",
            score: 3.8, // maps to index 4 (5 out of 5)
            confidence: 0.9,
            probabilities: {},
            legend: {},
          },
        },
      } as any);

      const rating = await rate("Exceptional customer service!", 1, 5);
      expect(rating).toBe(5);
    });

    it("should rate string rubric e.g. low/med/high", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: {
          scoring: {
            type: "score",
            score: 2.0, // maps to "critical"
            confidence: 0.95,
            probabilities: {},
            legend: {},
          },
        },
      } as any);

      const level = await rate("All production servers are down!", [
        "low",
        "medium",
        "critical",
      ]);
      expect(level).toBe("critical");
    });
  });

  describe("natural() / n() fluent wrapper", () => {
    it("natural(text).is() should work fluently", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: { condition: { type: "noul", noul: 0.91 } },
      } as any);

      expect(await natural("Need urgent help").is("urgent")).toBe(true);
    });

    it("n(text).pick() should work fluently", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: {
          best: {
            type: "choice",
            choice: "tech",
            confidence: 0.9,
            probabilities: { tech: 0.9, sales: 0.1 },
          },
        },
      } as any);

      expect(await n("500 Server Error").pick(["tech", "sales"])).toBe("tech");
    });
  });

  describe("simplified signatures for core functions", () => {
    it("classify() should accept simple string array", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: {
          classification: {
            type: "choice",
            choice: "refund",
            confidence: 0.88,
            probabilities: { refund: 0.88, billing: 0.12 },
          },
        },
      } as any);

      const res = await classify("cancel and refund me", ["refund", "billing"]);
      expect(res.choice).toBe("refund");
    });

    it("score() should accept simple string array", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: {
          scoring: {
            type: "score",
            score: 1.0,
            confidence: 0.85,
            probabilities: {},
            legend: {},
          },
        },
      } as any);

      const res = await score("somewhat fast", ["slow", "medium", "fast"]);
      expect(res.label).toBe("medium");
    });

    it("guard() should accept simple string array", async () => {
      vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
        answers: {
          spam: { type: "noul", noul: 0.9 },
        },
      } as any);

      const res = await guard("free crypto", ["spam"]);
      expect(res.action).toBe("block");
    });
  });
});
