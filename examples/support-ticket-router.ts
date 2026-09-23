// ─────────────────────────────────────────────────────────────
// Example: Support Ticket Router
// ─────────────────────────────────────────────────────────────
//
// Run with: npx tsx examples/support-ticket-router.ts
//
// Requires TYPESAFE_API_KEY environment variable.

import {
  configure,
  classify,
  check,
  checkAll,
  guard,
  score,
  compositeScore,
  route,
  contentFilter,
  validate,
  pickBest,
} from "../src/index.js";

// ── Configuration ───────────────────────────────────────────

// configure() is optional if TYPESAFE_API_KEY is set in the env.
// configure({ apiKey: process.env.TYPESAFE_API_KEY });

const ticket =
  "I've been trying to connect my Stripe account for 3 days and the " +
  "integration keeps failing with a 500 error. I'm losing sales every " +
  "day this is broken. Please help ASAP.";

async function main() {
  console.log("═══════════════════════════════════════════");
  console.log("  NaturalCodz — Support Ticket Router Demo");
  console.log("═══════════════════════════════════════════");
  console.log();
  console.log("Ticket:", ticket);
  console.log();

  // 1. Safety check first
  console.log("── 1. Content Filter ──────────────────────");
  const safety = await contentFilter(ticket);
  console.log("  Action:", safety.action);
  console.log("  Details:", safety.details);
  console.log();

  if (safety.action === "block") {
    console.log("Blocked — stopping here.");
    return;
  }

  // 2. Classify the ticket
  console.log("── 2. Classify ────────────────────────────");
  const category = await classify(ticket, {
    billing: "Payment or subscription issues",
    technical: "Bugs, errors, or integration problems",
    sales: "Pricing, plans, or account questions",
    general: "Everything else",
  });
  console.log("  Category:", category.choice);
  console.log("  Confidence:", category.confidence);
  console.log("  Confident?", category.isConfident);
  console.log();

  // 3. Multi-check in a single API call
  console.log("── 3. Check All ───────────────────────────");
  const checks = await checkAll(ticket, {
    urgent: "Does this message express urgency or time-sensitivity?",
    frustrated: "Is the customer frustrated or angry?",
    revenue_impact: "Does the customer mention financial or revenue impact?",
    refund: "Is the customer requesting a refund?",
  });
  for (const [id, result] of Object.entries(checks)) {
    console.log(
      `  ${id}: ${result.probability.toFixed(2)} → ${result.answer ? "YES" : "NO"}${result.isStrong ? " (strong)" : ""}`,
    );
  }
  console.log();

  // 4. Composite scoring for priority
  console.log("── 4. Priority Score ──────────────────────");
  const priority = await compositeScore(ticket, {
    severity: {
      weight: 0.4,
      rubric: [
        "Cosmetic issue, no impact",
        "Degraded functionality but workaround exists",
        "Broken feature, no workaround",
        "Total outage or data loss",
      ],
      instructions: "How severe is the reported issue?",
    },
    frustration: {
      weight: 0.3,
      rubric: [
        "Calm, just stating facts",
        "Frustrated but civil",
        "Very angry, strong language",
      ],
      instructions: "How frustrated does the customer appear?",
    },
    actionability: {
      weight: 0.3,
      rubric: [
        "Vague, no useful details",
        "Some information to go on",
        "Detailed with clear steps to reproduce",
      ],
      instructions:
        "How much actionable information does the ticket provide for engineering?",
    },
  });
  console.log("  Composite total:", priority.total);
  console.log("  Min confidence:", priority.minConfidence);
  for (const [dim, r] of Object.entries(priority.dimensions)) {
    console.log(
      `  ${dim}: score=${r.score.toFixed(1)} (${r.label}), confidence=${r.confidence.toFixed(2)}`,
    );
  }
  console.log();

  // 5. Route to handler
  console.log("── 5. Route ───────────────────────────────");
  const destination = await route(ticket, {
    destinations: {
      billing_team: "Payment, charges, subscription issues",
      engineering: "Bugs, errors, integration problems",
      sales_team: "Pricing, plans, enterprise inquiries",
      general_support: "Everything else",
    },
    fallback: "general_support",
    confidenceThreshold: 0.5,
    instructions: "Which team should handle this support ticket?",
  });
  console.log("  Routed to:", destination.choice);
  console.log("  Confidence:", destination.confidence);
  console.log("  Used fallback?", destination.usedFallback);
  console.log();

  // 6. Pick best matching KB article
  console.log("── 6. Pick Best KB Article ────────────────");
  const best = await pickBest(
    { ticket, category: category.choice },
    [
      "Stripe integration troubleshooting guide",
      "PayPal setup FAQ",
      "Billing and invoicing overview",
      "API error codes reference",
      "Account settings and permissions",
    ],
    "Which knowledge base article is most relevant to this support ticket?",
  );
  console.log("  Best article:", best.choice);
  console.log("  Confidence:", best.confidence);
  console.log();

  // Summary
  console.log("═══════════════════════════════════════════");
  console.log("  ROUTING DECISION");
  console.log("═══════════════════════════════════════════");
  console.log(`  Category:    ${category.choice}`);
  console.log(`  Priority:    ${(priority.total * 100).toFixed(0)}%`);
  console.log(`  Route to:    ${destination.choice}`);
  console.log(`  Urgent:      ${checks.urgent.answer ? "YES" : "NO"}`);
  console.log(`  KB article:  ${best.choice}`);
  console.log("═══════════════════════════════════════════");
}

main().catch(console.error);
