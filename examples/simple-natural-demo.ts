// ─────────────────────────────────────────────────────────────
// NaturalCodz — Simplest Forms Demo (Child's Play AI Logic)
// ─────────────────────────────────────────────────────────────
//
// Run with: npx tsx --env-file=.env examples/simple-natural-demo.ts
//
// This file demonstrates how NaturalCodz makes natural-language
// logic as simple and direct as native JavaScript!

import natural, {
  is,
  isSafe,
  isSpam,
  isToxic,
  hasPII,
  pick,
  rate,
  classify,
  createNatural,
} from "../src/index.js";

async function main() {
  console.log("══════════════════════════════════════════════════════════════");
  console.log("  NaturalCodz — All Features in Their Simplest Forms");
  console.log("══════════════════════════════════════════════════════════════\n");

  // 1. is() — Ask any yes/no question in pure English (returns boolean)
  console.log("1. is() — Plain English Boolean Questions");
  console.log("──────────────────────────────────────────────────────────────");
  const msg1 = "I demand to speak to your manager right now! This is ridiculous!";
  const msg2 = "Just checking if my order has been shipped yet.";

  console.log(`Msg: "${msg1}"`);
  console.log(`  is(msg, "angry")?              ->`, await is(msg1, "angry"));
  console.log(`  is(msg, "asking for refund")?  ->`, await is(msg1, "asking for refund"));

  console.log(`Msg: "${msg2}"`);
  console.log(`  is(msg, "angry")?              ->`, await is(msg2, "angry"));
  console.log(`  is(msg, "asking about order")? ->`, await is(msg2, "asking about order"));
  console.log();

  // 2. is.not() — Negative checks
  console.log("2. is.not() — Negative Conditions");
  console.log("──────────────────────────────────────────────────────────────");
  console.log(`  is.not("${msg2}", "spam")?     ->`, await is.not(msg2, "spam"));
  console.log();

  // 3. Safety Guardrails — 1-liner boolean checks
  console.log("3. Safety One-Liners: isSafe, isSpam, isToxic, hasPII");
  console.log("──────────────────────────────────────────────────────────────");
  const cleanText = "Great product! The interface is very intuitive.";
  const spamText = "CLAIM FREE $1000 BITCOIN BONUS NOW CLICK HERE: http://bonus.xyz";
  const toxicText = "You people are brainless morons and completely useless.";
  const piiText = "My email is john.doe@secret.com and my phone is 555-123-4567.";

  console.log(`Clean: "${cleanText}"`);
  console.log(`  isSafe?  ->`, await isSafe(cleanText));

  console.log(`Spam:  "${spamText}"`);
  console.log(`  isSpam?  ->`, await isSpam(spamText));

  console.log(`Toxic: "${toxicText}"`);
  console.log(`  isToxic? ->`, await isToxic(toxicText));

  console.log(`PII:   "${piiText}"`);
  console.log(`  hasPII?  ->`, await hasPII(piiText));
  console.log();

  // 4. pick() — Choose the best option directly as a string
  console.log("4. pick() — Choose Option from an Array (returns string)");
  console.log("──────────────────────────────────────────────────────────────");
  const supportTicket = "The export button is grayed out and clicking it throws a 500 error.";
  const chosenDepartment = await pick(supportTicket, [
    "billing",
    "engineering",
    "sales",
    "human_resources",
  ]);
  console.log(`Ticket: "${supportTicket}"`);
  console.log(`  pick(ticket, ["billing", "engineering", "sales", "hr"])`);
  console.log(`  Result: "${chosenDepartment}"\n`);

  const userQuestion = "How do I upgrade from pro to enterprise?";
  const matchedDoc = await pick(userQuestion, [
    "Troubleshooting Login Errors",
    "Billing & Subscription Upgrades",
    "API Key Management",
  ]);
  console.log(`Question: "${userQuestion}"`);
  console.log(`  Matched Doc: "${matchedDoc}"\n`);

  // 5. rate() — Score on 1-5 scale or rubric words
  console.log("5. rate() — Simple Rating");
  console.log("──────────────────────────────────────────────────────────────");
  const review = "Hands down the best developer tool I've used this year. Saved our team days!";
  const starRating = await rate(review, 1, 5);
  console.log(`Review: "${review}"`);
  console.log(`  rate(review, 1, 5) -> ${starRating} / 5 stars\n`);

  const incident = "Production database is dropping connections, active user checkouts failing!";
  const urgencyWord = await rate(incident, ["low", "medium", "high", "critical"]);
  console.log(`Incident: "${incident}"`);
  console.log(`  rate(incident, ["low", "medium", "high", "critical"]) -> [${String(urgencyWord).toUpperCase()}]\n`);

  // 6. classify() — Simplified with plain string arrays
  console.log("6. classify() — Simple String Array Classification");
  console.log("──────────────────────────────────────────────────────────────");
  const feedback = "Could you please add dark mode and webhook support?";
  const category = await classify(feedback, [
    "bug_report",
    "feature_request",
    "billing",
    "compliment",
  ]);
  console.log(`Feedback: "${feedback}"`);
  console.log(`  Category: "${category.choice}" (confidence: ${(category.confidence * 100).toFixed(0)}%)\n`);

  // 7. natural() / default export — Fluent Chaining
  console.log("7. natural(text) — Fluent Natural Language Chaining");
  console.log("──────────────────────────────────────────────────────────────");
  const alertText = "CRITICAL: Memory leak detected in worker container cluster!";

  const isUrgent = await natural(alertText).is("a system emergency");
  const targetTeam = await natural(alertText).pick(["frontend", "devops", "marketing"]);
  const severity = await natural(alertText).rate(["minor", "major", "catastrophic"]);

  console.log(`Input: "${alertText}"`);
  console.log(`  natural(text).is("a system emergency")       ->`, isUrgent);
  console.log(`  natural(text).pick(["frontend", "devops"])   ->`, targetTeam);
  console.log(`  natural(text).rate(["minor", "catastrophic"]) ->`, severity);
  console.log();

  // 8. createNatural() — Scoped Instance with Custom Accuracy Thresholds
  console.log("8. createNatural() — Scoped Instance with Custom Thresholds");
  console.log("──────────────────────────────────────────────────────────────");
  const customAI = createNatural({
    thresholds: {
      boolean: 0.7, // Stricter requirement
      confidence: 0.8,
    },
  });
  const customAnswer = await customAI.is(msg1, "angry");
  const customPick = await customAI.pick(supportTicket, ["billing", "engineering"]);

  console.log(`  customAI.is("${msg1}", "angry") ->`, customAnswer);
  console.log(`  customAI.pick("${supportTicket}", ["billing", "engineering"]) ->`, customPick);
  console.log();

  console.log("══════════════════════════════════════════════════════════════");
  console.log("  All natural logic primitives executed successfully!");
  console.log("══════════════════════════════════════════════════════════════");
}

main().catch(console.error);
