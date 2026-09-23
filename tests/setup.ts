import { beforeEach } from "vitest";
import { configure } from "../src/index.js";

// Ensure a dummy API key is present for offline unit tests with mocks
process.env.TYPESAFE_API_KEY = process.env.TYPESAFE_API_KEY || "ts_test_key_mock_123456789";

beforeEach(() => {
  configure({
    apiKey: "ts_test_key_mock_123456789",
    model: "jev-latest",
    defaultConfidenceThreshold: 0.6,
  });
});
