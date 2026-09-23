// ─────────────────────────────────────────────────────────────
// Example: Content Moderation & Guardrails
// ─────────────────────────────────────────────────────────────
//
// Run with: npx tsx --env-file=.env examples/content-moderation.ts
//
// Requires TYPESAFE_API_KEY environment variable.

import { guard, contentFilter, validate } from "../src/index.js";

const samples = [
  {
    name: "Safe customer feedback",
    text: "The delivery arrived on time, but the packaging was slightly damaged. Overall satisfied with the product quality.",
  },
  {
    name: "Promotional spam",
    text: "CONGRATULATIONS!! You won a $1,000 gift card! Click here to claim: http://scam-rewards.xyz/free?ref=123",
  },
  {
    name: "PII leak",
    text: "Hi support, my SSN is 000-12-3456 and my billing credit card is 4111-2222-3333-4444. Can you refund me?",
  },
  {
    name: "Toxic / Harassment",
    text: "You people are complete idiots and I hope your whole company burns to the ground. Fire everyone now.",
  },
];

async function main() {
  console.log("══════════════════════════════════════════════════════");
  console.log("  NaturalCodz — Content Moderation & Guardrails Demo");
  console.log("══════════════════════════════════════════════════════\n");

  for (const sample of samples) {
    console.log(`──────────────────────────────────────────────────────────`);
    console.log(`Sample: "${sample.name}"`);
    console.log(`Input:  "${sample.text}"\n`);

    // 1. Run through pre-built content safety filter
    const safety = await contentFilter(sample.text);
    console.log(`  [contentFilter] Recommendation: ${safety.action.toUpperCase()}`);
    if (safety.triggered.length > 0) {
      console.log(`  [contentFilter] Triggered:      ${safety.triggered.join(", ")}`);
    }
    console.log(`  [contentFilter] Details:        ${JSON.stringify(safety.details)}`);

    // 2. Custom domain-specific guardrail rules
    const customGuard = await guard(sample.text, {
      rules: {
        financial_credentials: "Contains credit card numbers, bank accounts, or crypto seed phrases",
        unprofessional: "Contains excessive hostility, verbal abuse, or aggressive profanity",
        legitimate_inquiry: "Is a legitimate inquiry or customer service question",
      },
      thresholds: {
        block: 0.8,
        review: 0.5,
      },
    });

    console.log(`  [custom guard]  Action:         ${customGuard.action}`);
    if (customGuard.triggered.length > 0) {
      console.log(`  [custom guard]  Flagged:        ${customGuard.triggered.join(", ")}`);
    }
    console.log();
  }

  // 3. User profile bio validation example
  console.log("──────────────────────────────────────────────────────────");
  console.log("Profile Bio Validation via validate()");
  console.log("──────────────────────────────────────────────────────────\n");

  const testBio =
    "Senior full-stack engineer passionate about distributed systems and TypeScript. DM me on telegram @dev123 or email me at me@secret.com!";

  const validation = await validate(testBio, [
    { id: "professional_tone", rule: "Written in a professional tone suited for a tech community" },
    { id: "no_contact_info", rule: "Does not contain direct email addresses, phone numbers, or messaging handles", threshold: 0.7 },
    { id: "informative", rule: "Mentions technical skills or professional background" },
  ]);

  console.log(`Bio: "${testBio}"\n`);
  console.log(`Valid:   ${validation.valid ? "YES" : "NO"}`);
  console.log(`Passed:  ${validation.passed.join(", ")}`);
  console.log(`Failed:  ${validation.failed.join(", ")}`);
  console.log(`Details:`, validation.details);
}

main().catch(console.error);
