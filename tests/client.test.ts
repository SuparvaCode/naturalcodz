import { describe, it, expect, beforeEach } from "vitest";
import { configure } from "../src/index.js";
import {
  getClient,
  getModel,
  getDefaultConfidenceThreshold,
} from "../src/client.js";

describe("Client Configuration", () => {
  beforeEach(() => {
    configure({
      apiKey: "test_key",
      model: "jev-latest",
      defaultConfidenceThreshold: 0.6,
    });
  });

  it("should have sensible defaults", () => {
    expect(getModel()).toBe("jev-latest");
    expect(getDefaultConfidenceThreshold()).toBe(0.6);
  });

  it("should update model and threshold via configure()", () => {
    configure({
      model: "jev-1.13.0",
      defaultConfidenceThreshold: 0.8,
    });

    expect(getModel()).toBe("jev-1.13.0");
    expect(getDefaultConfidenceThreshold()).toBe(0.8);
  });

  it("should create client instance", () => {
    configure({ apiKey: "test_custom_key" });
    const client = getClient();
    expect(client).toBeDefined();
    // Subsequent calls return the same instance
    expect(getClient()).toBe(client);
  });
});
