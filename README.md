# NaturalCodz

Natural logic utilities powered by Jev AI (TypeSafe). Classify, guard, route, score, and evaluate text with confidence-aware primitives.

Author: Suparva

[![npm](https://img.shields.io/npm/v/naturalcodz)](https://www.npmjs.com/package/naturalcodz)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Installation

```bash
npm install naturalcodz
```

Requires Node.js 20+ and a [TypeSafe API key](https://console.typesafe.ai/keys).

## Quick Start

```ts
import natural, { is, isSafe, isSpam, isToxic, hasPII, pick, rate, classify } from 'naturalcodz';

// Boolean checks
if (await is(comment, "angry")) {
  escalateToSupport(comment);
}

if (await is(message, "asking for a refund")) {
  openRefundFlow(message);
}

// Safety guards
if (!await isSafe(userInput)) denyRequest();
if (await isSpam(message)) dropMessage();
if (await isToxic(chat)) banUser();
if (await hasPII(bio)) hideProfile();

// Option selection
const department = await pick(ticket, ["billing", "engineering", "sales"]);

// Rating
const stars = await rate(review, 1, 5);
const urgency = await rate(incident, ["low", "medium", "high", "critical"]);

// Classification
const res = await classify(feedback, ["bug_report", "feature_request", "billing"]);
console.log(res.choice);

// Fluent chaining
if (await natural(userInput).is("urgent")) {
  const team = await natural(userInput).pick(["frontend", "devops"]);
}
```

---

## Configuration

### Global Configuration

Call `configure()` once at startup. If omitted, NaturalCodz reads `TYPESAFE_API_KEY` from the environment:

```ts
import { configure } from 'naturalcodz';

configure({
  apiKey: process.env.TYPESAFE_API_KEY,
  model: 'jev-latest',
  thresholds: {
    boolean: 0.65,     // Cutoff for is(), check(), etc. (default: 0.5)
    strong: 0.85,      // Cutoff for isStrong flag (default: 0.8)
    confidence: 0.75,  // Cutoff for classify(), pick() (default: 0.6)
    guardBlock: 0.8,   // Cutoff to block unsafe content (default: 0.85)
    guardReview: 0.45, // Cutoff to flag content for review (default: 0.5)
  },
});
```

### Scoped Instances

For multi-tenant setups, microservices, or custom configurations:

```ts
import { createNatural } from 'naturalcodz';

export const strictAI = createNatural({
  apiKey: process.env.TYPESAFE_API_KEY,
  thresholds: {
    boolean: 0.8,
    confidence: 0.85,
  },
});

if (await strictAI.is(userMessage, "demanding a refund")) {
  // ...
}
const dept = await strictAI.pick(ticket, ["billing", "legal"]);
```

### Per-Call Overrides

Override thresholds on individual calls without altering global settings:

```ts
const urgent = await is(message, "urgent", { threshold: 0.85 });
const safe = await isSafe(content, { blockThreshold: 0.9, reviewThreshold: 0.4 });
```

---

## API Reference

### Boolean Checks

#### `is(input, condition, options?)`

Evaluates whether a condition is true for the input and returns a boolean.

```ts
const angry = await is(message, "angry");
const refund = await is(message, "asking for refund", { threshold: 0.75 });
```

#### `is.not(input, condition, options?)`

Inverted condition check.

```ts
if (await is.not(message, "spam")) {
  processMessage(message);
}
```

#### `check(input, condition, options?)`

Evaluates a condition and returns probability and signal strength.

```ts
const result = await check(message, "Does this message express urgency?");

result.probability  // 0.92
result.answer       // true
result.isStrong     // true
```

#### `checkAll(input, conditions, options?)`

Evaluates multiple conditions in parallel in a single API call.

```ts
const checks = await checkAll(message, {
  urgent: "Does this message express urgency?",
  refund: "Is the customer requesting a refund?",
  escalation: "Should this be escalated to a manager?",
});

checks.urgent.probability     // 0.92
checks.refund.probability     // 0.15
checks.escalation.probability // 0.78
```

#### `validate(input, rules)`

Validates an input against multiple subjective criteria.

```ts
const result = await validate(userBio, [
  { id: "professional", rule: "Written in a professional tone" },
  { id: "no_contact", rule: "Does not contain personal contact info" },
]);

result.valid   // false
result.passed  // ["professional"]
result.failed  // ["no_contact"]
```

---

### Safety and Guardrails

#### `isSafe(input, options?)`

Returns `true` if input passes safety checks (hate speech, harassment, spam, PII, self-harm, illegal activity).

```ts
if (!await isSafe(userComment)) {
  dropMessage();
}
```

#### `isSpam(input, options?)` / `isToxic(input, options?)` / `hasPII(input, options?)`

Single-condition safety checks.

```ts
if (await isSpam(message)) drop();
if (await isToxic(chat)) muteUser();
if (await hasPII(bio)) redactBio();
```

#### `guard(input, rules, thresholds?)`

Screens input against custom rules with pass/review/block recommendations.

```ts
const result = await guard(userMessage, {
  rules: {
    toxic: "Contains hate speech or personal attacks",
    spam: "Is promotional spam",
    pii: "Contains personally identifiable information",
  },
  thresholds: { block: 0.85, review: 0.5 },
});

result.action     // "pass" | "review" | "block"
result.triggered  // ["pii"]
result.details    // { toxic: 0.02, spam: 0.01, pii: 0.72 }
```

#### `contentFilter(input, options?)`

Pre-configured safety filter returning full classification details.

```ts
const result = await contentFilter(userMessage);
if (result.action !== "pass") handleViolation(result);
```

---

### Classification

#### `classify(input, categories, options?)`

Categorizes input using either a string array or a map with descriptions.

```ts
// Array syntax
const res1 = await classify(ticket, ["billing", "technical", "sales"]);
console.log(res1.choice); // "billing"

// Detailed map syntax
const res2 = await classify(ticket, {
  billing: "Payment or subscription issues",
  technical: "Bugs or integration problems",
  sales: "Pricing or account questions",
});
```

#### `multiClassify(input, dimensions)`

Evaluates multiple classification dimensions in parallel in a single API call.

```ts
const results = await multiClassify(ticket, {
  department: {
    instructions: "Which department should handle this?",
    categories: { billing: "Payment issues", tech: "Technical bugs" },
  },
  priority: {
    instructions: "What is the priority level?",
    categories: { low: null, medium: null, high: null },
  },
});

results.department.choice  // "tech"
results.priority.choice    // "high"
```

---

### Selection and Routing

#### `pick(input, candidates, criteriaOrOptions?)`

Selects the best option from an array and returns the chosen string directly.

```ts
const chosen = await pick(ticket, ["billing", "engineering", "sales"]);
// "engineering"
```

#### `route(input, config)`

Routes input with confidence-gated fallback.

```ts
const dest = await route(userInput, {
  destinations: {
    billing: "Payment, charges, invoices",
    technical: "Bugs, errors, API issues",
    general: "Everything else",
  },
  fallback: "general",
  confidenceThreshold: 0.5,
});

dest.choice        // "technical"
dest.usedFallback  // false
```

#### `createRouter(config)`

Creates an intent router that dispatches directly to handler functions.

```ts
const handleTicket = createRouter({
  intents: {
    refund: "Customer wants money back",
    bug: "Customer reports a bug",
  },
  handlers: {
    refund: (input) => processRefund(input),
    bug: (input) => fileBugReport(input),
  },
  fallbackHandler: (input) => routeToHuman(input),
});

const { intent, result } = await handleTicket(customerMessage);
```

---

### Scoring

#### `rate(input, minOrRubric, maxOrCriteria?, criteria?)`

Rates input numerically or across an ordered word scale.

```ts
// Numerical rating (returns 1..5)
const stars = await rate(review, 1, 5);

// Ordered scale rating (returns matching label)
const urgency = await rate(ticket, ["low", "medium", "high", "critical"]);
```

#### `score(input, rubric, instructions?)`

Scores input against an ordered rubric, returning score, label, confidence, and normalized values.

```ts
const result = await score(ticket, [
  "Not urgent",
  "Mildly urgent",
  "Urgent",
  "Critical",
]);

result.score       // 2
result.label       // "Urgent"
result.normalized  // 0.67
result.confidence  // 0.88
```

#### `compositeScore(input, dimensions)`

Evaluates multiple dimensions with weighted combination in a single request.

```ts
const priority = await compositeScore(ticket, {
  severity: {
    weight: 0.4,
    rubric: ["Cosmetic", "Degraded", "Broken", "Total outage"],
    instructions: "How severe is the reported issue?",
  },
  frustration: {
    weight: 0.3,
    rubric: ["Calm", "Frustrated", "Very angry"],
    instructions: "How frustrated is the customer?",
  },
  actionability: {
    weight: 0.3,
    rubric: ["Vague", "Some info", "Detailed with steps"],
    instructions: "How actionable is this report?",
  },
});

priority.total          // 0.72
priority.minConfidence  // 0.75
```

---

### Fluent Chaining

#### `natural(input)` / `n(input)`

Provides method chaining on any input:

```ts
import natural from 'naturalcodz';

if (await natural(text).is("urgent")) {
  const team = await natural(text).pick(["support", "engineering"]);
  const score = await natural(text).rate(1, 5);
}
```

---

## Examples

Runnable example scripts are available in the [`examples/`](examples) directory:

- **[`examples/simple-natural-demo.ts`](examples/simple-natural-demo.ts)**: All features demonstrated in their simplest forms.
- **[`examples/support-ticket-router.ts`](examples/support-ticket-router.ts)**: End-to-end support triage combining safety screening, classification, scoring, and routing.
- **[`examples/content-moderation.ts`](examples/content-moderation.ts)**: Input screening against spam, PII, harassment, and bio validation.
- **[`examples/user-input-classifier.ts`](examples/user-input-classifier.ts)**: Multi-dimensional intent classification and handler dispatch.

Run any example with:

```bash
npx tsx --env-file=.env examples/simple-natural-demo.ts
```

---

## Architecture

NaturalCodz uses TypeSafe's Jev model family (System One decision models). Rather than generating unstructured text, Jev evaluates state against typed questions and returns structured decisions:

- **Single-request parallelization**: Multi-condition evaluations (`checkAll`, `multiClassify`, `compositeScore`) execute concurrently in one API round-trip.
- **Typed values by construction**: No regex, JSON repair, or text parsing.
- **Confidence scores**: Every result includes confidence estimates for building graduated fallbacks.

## License

MIT
