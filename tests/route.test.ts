import { describe, it, expect, vi, beforeEach } from "vitest";
import { TypeSafeClient } from "@typesafe-ai/sdk";
import { route, createRouter, APICallError } from "../src/index.js";

describe("route()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should return the chosen destination when confidence meets threshold", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        routing: {
          type: "choice",
          choice: "billing",
          confidence: 0.85,
          probabilities: { billing: 0.85, technical: 0.1, sales: 0.05 },
        },
      },
    } as any);

    const result = await route("Invoice question", {
      destinations: {
        billing: "Billing and invoices",
        technical: "Technical problems",
        sales: "Sales inquiries",
      },
      fallback: "technical",
      confidenceThreshold: 0.6,
    });

    expect(result.choice).toBe("billing");
    expect(result.confidence).toBe(0.85);
    expect(result.usedFallback).toBe(false);
  });

  it("should use fallback when confidence is below threshold", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        routing: {
          type: "choice",
          choice: "sales",
          confidence: 0.35,
          probabilities: { sales: 0.35, billing: 0.33, technical: 0.32 },
        },
      },
    } as any);

    const result = await route("Ambiguous question", {
      destinations: {
        billing: "Billing and invoices",
        technical: "Technical problems",
        sales: "Sales inquiries",
      },
      fallback: "technical",
      confidenceThreshold: 0.6,
    });

    expect(result.choice).toBe("technical");
    expect(result.confidence).toBe(0.35);
    expect(result.usedFallback).toBe(true);
  });
});

describe("createRouter()", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("should dispatch to matching intent handler", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        intent: {
          type: "choice",
          choice: "refund",
          confidence: 0.9,
          probabilities: { refund: 0.9, bug: 0.1 },
        },
      },
    } as any);

    const router = createRouter({
      intents: {
        refund: "Customer wants money back",
        bug: "Customer reports a bug",
      },
      handlers: {
        refund: async (msg) => `Refund processed for: ${msg}`,
        bug: async (msg) => `Bug filed: ${msg}`,
      },
    });

    const res = await router("Please refund my purchase");
    expect(res.intent).toBe("refund");
    expect(res.confidence).toBe(0.9);
    expect(res.usedFallback).toBe(false);
    expect(res.result).toBe("Refund processed for: Please refund my purchase");
  });

  it("should dispatch to fallbackHandler when confidence is low", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        intent: {
          type: "choice",
          choice: "refund",
          confidence: 0.3,
          probabilities: { refund: 0.3, bug: 0.7 },
        },
      },
    } as any);

    const router = createRouter({
      intents: {
        refund: "Refund request",
        bug: "Bug report",
      },
      handlers: {
        refund: async () => "refund",
        bug: async () => "bug",
      },
      fallbackHandler: async (msg) => `Routed to human: ${msg}`,
      confidenceThreshold: 0.5,
    });

    const res = await router("Confusing message");
    expect(res.usedFallback).toBe(true);
    expect(res.result).toBe("Routed to human: Confusing message");
  });

  it("should throw APICallError when handler missing and no fallbackHandler", async () => {
    vi.spyOn(TypeSafeClient.prototype, "systemOne").mockResolvedValueOnce({
      model: "jev-latest",
      metadata: { usage: { total_tokens: 10 } },
      answers: {
        intent: {
          type: "choice",
          choice: "unknown_intent",
          confidence: 0.9,
          probabilities: { unknown_intent: 0.9 },
        },
      },
    } as any);

    const router = createRouter({
      intents: {
        unknown_intent: "Something",
      },
      handlers: {} as any,
    });

    await expect(router("test")).rejects.toThrow(APICallError);
  });
});
