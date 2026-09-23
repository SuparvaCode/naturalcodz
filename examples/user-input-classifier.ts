// ─────────────────────────────────────────────────────────────
// Example: User Input Classifier & Dynamic Routing
// ─────────────────────────────────────────────────────────────
//
// Run with: npx tsx --env-file=.env examples/user-input-classifier.ts
//
// Requires TYPESAFE_API_KEY environment variable.

import { classify, multiClassify, createRouter } from "../src/index.js";

const incomingMessages = [
  "Can I upgrade my monthly team subscription to an annual enterprise plan?",
  "When I click 'export CSV' on the analytics page, the spinner runs forever and nothing downloads.",
  "What is your refund policy if we decide to cancel after 14 days?",
  "Can you integrate with Salesforce and HubSpot for lead synchronization?",
];

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  NaturalCodz — User Input Classifier & Intent Router Demo");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // 1. Single classification with confidence thresholding
  console.log("── 1. Single Classification ───────────────────────────────────");
  for (const msg of incomingMessages) {
    const res = await classify(msg, {
      sales: "Pricing, plan upgrades, enterprise packages, sales inquiries",
      bug_report: "Broken features, errors, infinite loaders, unexpected behavior",
      billing: "Invoices, payment methods, refund policies, receipts",
      feature_request: "Requests for new integrations, tools, or functionalities",
    });

    console.log(`Msg:        "${msg}"`);
    console.log(`Classified: ${res.choice.toUpperCase()} (confidence: ${(res.confidence * 100).toFixed(0)}%, isConfident: ${res.isConfident})`);
    console.log(`Probabilities:`, res.probabilities);
    console.log();
  }

  // 2. Multi-dimensional classification in one call
  console.log("── 2. Multi-Dimensional Classification (Parallel Fan-Out) ─────");
  const complexMessage = "We are an enterprise team of 500. We need custom SSO SAML integration ASAP before our next quarter starts.";

  const multiRes = await multiClassify(complexMessage, {
    customer_tier: {
      instructions: "What tier of customer does this message represent?",
      categories: {
        enterprise: "Large team (100+), mentions enterprise/SAML/custom requirements",
        mid_market: "Growing company, 20-100 seats",
        individual: "Single user, pro or hobby tier",
      },
    },
    topic: {
      instructions: "What is the primary topic?",
      categories: {
        auth_security: "SSO, SAML, identity providers, security compliance",
        pricing_billing: "Cost, discounts, payment terms",
        general_support: "General support question",
      },
    },
    urgency: {
      instructions: "How urgent is this timeline?",
      categories: {
        critical: "Hard upcoming deadline, ASAP, time-sensitive quarter deadline",
        standard: "Normal inquiry, no immediate rush",
      },
    },
  });

  console.log(`State: "${complexMessage}"\n`);
  for (const [dim, val] of Object.entries(multiRes)) {
    console.log(`  ${dim}: ${val.choice} (conf: ${(val.confidence * 100).toFixed(0)}%)`);
  }
  console.log();

  // 3. Functional Intent Router with handlers
  console.log("── 3. Intent Router Dispatch ──────────────────────────────────");
  const router = createRouter({
    intents: {
      sales: "Sales inquiries, upgrade requests, enterprise contracts",
      technical: "Bug reports, broken functions, crashes",
      billing: "Refund requests, invoice issues",
    },
    handlers: {
      sales: async (input) => `[CRM Lead Created] Assigning enterprise rep to message: "${input}"`,
      technical: async (input) => `[Jira Ticket Created] Alerting on-call engineering for issue: "${input}"`,
      billing: async (input) => `[Stripe Action Triggered] Reviewing billing account for: "${input}"`,
    },
    fallbackHandler: async (input) => `[Support Queue] Moving unconfident request to triage agent: "${input}"`,
    confidenceThreshold: 0.65,
  });

  const dispatchResult = await router("Our export pipeline is throwing 502 Bad Gateway errors.");
  console.log("Dispatched:", dispatchResult);
}

main().catch(console.error);
