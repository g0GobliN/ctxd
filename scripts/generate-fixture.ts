/**
 * Generate the `stripe-webhook` benchmark fixture.
 *
 * The fixture is a realistic payment service: a handful of files that genuinely
 * matter to a Stripe idempotency task, surrounded by a much larger body of
 * unrelated code, duplicated documentation and stale sessions. Candidate
 * context must exceed 50,000 estimated tokens so the benchmark measures real
 * selection pressure rather than a toy directory.
 *
 * Task-relevant files are written literally, because their content decides
 * whether the benchmark's MUST_INCLUDE assertions are meaningful. The bulk of
 * the irrelevant modules is templated — realistic in shape, deliberately
 * uninteresting to the task.
 *
 * Deterministic: same inputs, same bytes, same timestamps on every run.
 *
 * Usage: node --experimental-strip-types scripts/generate-fixture.ts
 */
import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "tests",
  "fixtures",
  "benchmarks",
  "stripe-webhook",
  "project",
);

/** Fixed clock so generated mtimes never drift between runs. */
const NOW = Date.parse("2026-08-01T12:00:00Z");
const DAY = 86_400_000;

const files: { path: string; content: string; ageDays: number }[] = [];

function add(path: string, content: string, ageDays: number): void {
  files.push({ path, content, ageDays });
}

// ---------------------------------------------------------------------------
// Task-relevant source — what a correct context build must find.
// ---------------------------------------------------------------------------

add(
  "src/payment/webhook.ts",
  `import type { Request, Response } from "express";
import { StripeAdapter } from "../stripe/adapter.js";
import { IdempotencyStore } from "./idempotency.js";
import { PaymentRepository } from "./payment-repository.js";
import { logger } from "../platform/logger.js";

/**
 * Stripe webhook entry point.
 *
 * Stripe retries webhook deliveries aggressively: the same event id can arrive
 * several times, including concurrently. Every handler below must therefore be
 * idempotent — see docs/rules.md and Decision #42.
 */
export class StripeWebhookHandler {
  constructor(
    private readonly stripe: StripeAdapter,
    private readonly idempotency: IdempotencyStore,
    private readonly payments: PaymentRepository,
  ) {}

  async handle(request: Request, response: Response): Promise<void> {
    const signature = request.header("stripe-signature");
    if (!signature) {
      response.status(400).send("missing signature");
      return;
    }

    const event = this.stripe.constructEvent(request.rawBody, signature);

    // The idempotency key is the Stripe event id: it is stable across retries
    // of the same delivery, which is exactly the duplicate we must collapse.
    const key = event.id;

    const existing = await this.idempotency.find(key);
    if (existing) {
      logger.info("duplicate stripe event ignored", { eventId: key });
      response.status(200).send({ status: "duplicate", paymentId: existing.resultId });
      return;
    }

    const reservation = await this.idempotency.reserve(key, event.type);
    if (!reservation.acquired) {
      // A concurrent delivery holds the reservation; returning 409 tells Stripe
      // to retry later rather than creating a second Payment.
      response.status(409).send({ status: "in-progress" });
      return;
    }

    try {
      const paymentId = await this.dispatch(event);
      await this.idempotency.complete(key, paymentId);
      response.status(200).send({ status: "ok", paymentId });
    } catch (error) {
      await this.idempotency.release(key);
      logger.error("stripe webhook failed", { eventId: key, error });
      response.status(500).send({ status: "error" });
    }
  }

  private async dispatch(event: StripeEvent): Promise<string> {
    switch (event.type) {
      case "payment_intent.succeeded":
        return this.payments.markSucceeded(event.data.object.id, event.data.object.amount);
      case "payment_intent.payment_failed":
        return this.payments.markFailed(event.data.object.id);
      case "charge.refunded":
        return this.payments.markRefunded(event.data.object.id);
      default:
        logger.debug("unhandled stripe event", { type: event.type });
        return "";
    }
  }
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: { id: string; amount: number } };
}
`,
  1,
);

add(
  "src/payment/idempotency.ts",
  `import { Database } from "../platform/database.js";

/**
 * Idempotency key store.
 *
 * Stripe may deliver the same event more than once, so every webhook is
 * processed under a reservation. The unique index on \`key\` is what actually
 * enforces correctness — application-level checks alone race.
 */
export interface IdempotencyRecord {
  key: string;
  operation: string;
  status: "reserved" | "completed";
  resultId: string | null;
  createdAt: Date;
}

export interface Reservation {
  acquired: boolean;
}

export class IdempotencyStore {
  constructor(private readonly db: Database) {}

  async find(key: string): Promise<IdempotencyRecord | null> {
    const row = await this.db.queryOne<IdempotencyRecord>(
      "SELECT key, operation, status, result_id AS resultId, created_at AS createdAt " +
        "FROM idempotency_keys WHERE key = $1 AND status = 'completed'",
      [key],
    );
    return row ?? null;
  }

  /**
   * Reserve a key. Returns \`acquired: false\` when another delivery of the
   * same event already holds it, which the caller answers with 409.
   */
  async reserve(key: string, operation: string): Promise<Reservation> {
    const inserted = await this.db.execute(
      "INSERT INTO idempotency_keys (key, operation, status, created_at) " +
        "VALUES ($1, $2, 'reserved', now()) ON CONFLICT (key) DO NOTHING",
      [key, operation],
    );
    return { acquired: inserted.rowCount === 1 };
  }

  async complete(key: string, resultId: string): Promise<void> {
    await this.db.execute(
      "UPDATE idempotency_keys SET status = 'completed', result_id = $2 WHERE key = $1",
      [key, resultId],
    );
  }

  /** Release a reservation so a later retry can make progress. */
  async release(key: string): Promise<void> {
    await this.db.execute(
      "DELETE FROM idempotency_keys WHERE key = $1 AND status = 'reserved'",
      [key],
    );
  }

  /** Reservations older than the retry window are abandoned work. */
  async expireStale(olderThanMinutes: number): Promise<number> {
    const result = await this.db.execute(
      "DELETE FROM idempotency_keys WHERE status = 'reserved' " +
        "AND created_at < now() - ($1 || ' minutes')::interval",
      [olderThanMinutes],
    );
    return result.rowCount;
  }
}
`,
  2,
);

add(
  "src/payment/payment-repository.ts",
  `import { Database } from "../platform/database.js";

/**
 * Persistence for payments.
 *
 * A duplicate Stripe event must never produce a second Payment row — the
 * webhook handler guarantees this with the idempotency store, and the unique
 * index on \`stripe_payment_intent_id\` is the backstop.
 */
export class PaymentRepository {
  constructor(private readonly db: Database) {}

  async markSucceeded(paymentIntentId: string, amount: number): Promise<string> {
    const row = await this.db.queryOne<{ id: string }>(
      "INSERT INTO payments (stripe_payment_intent_id, amount, status) " +
        "VALUES ($1, $2, 'succeeded') " +
        "ON CONFLICT (stripe_payment_intent_id) DO UPDATE SET status = 'succeeded' " +
        "RETURNING id",
      [paymentIntentId, amount],
    );
    return row.id;
  }

  async markFailed(paymentIntentId: string): Promise<string> {
    const row = await this.db.queryOne<{ id: string }>(
      "UPDATE payments SET status = 'failed' WHERE stripe_payment_intent_id = $1 RETURNING id",
      [paymentIntentId],
    );
    return row.id;
  }

  async markRefunded(chargeId: string): Promise<string> {
    const row = await this.db.queryOne<{ id: string }>(
      "UPDATE payments SET status = 'refunded' WHERE stripe_charge_id = $1 RETURNING id",
      [chargeId],
    );
    return row.id;
  }

  async findByIntent(paymentIntentId: string): Promise<{ id: string; status: string } | null> {
    return this.db.queryOne("SELECT id, status FROM payments WHERE stripe_payment_intent_id = $1", [
      paymentIntentId,
    ]);
  }
}
`,
  3,
);

add(
  "src/stripe/adapter.ts",
  `import Stripe from "stripe";
import { config } from "../platform/config.js";

/**
 * Thin wrapper over the Stripe SDK.
 *
 * Signature verification lives here so the webhook handler never touches raw
 * secrets, and so retries and idempotency behaviour are testable in isolation.
 */
export class StripeAdapter {
  private readonly client: Stripe;

  constructor(apiKey: string = config.stripe.apiKey) {
    this.client = new Stripe(apiKey, { apiVersion: "2024-06-20" });
  }

  /** Verify the webhook signature and decode the event. */
  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.client.webhooks.constructEvent(payload, signature, config.stripe.webhookSecret);
  }

  /**
   * Create a payment intent with an idempotency key so a retried request
   * never charges the customer twice.
   */
  async createPaymentIntent(amount: number, currency: string, idempotencyKey: string) {
    return this.client.paymentIntents.create(
      { amount, currency, automatic_payment_methods: { enabled: true } },
      { idempotencyKey },
    );
  }

  async retrievePaymentIntent(id: string) {
    return this.client.paymentIntents.retrieve(id);
  }
}
`,
  5,
);

add(
  "tests/payment/webhook.test.ts",
  `import { describe, expect, it, vi } from "vitest";
import { StripeWebhookHandler } from "../../src/payment/webhook.js";

describe("StripeWebhookHandler", () => {
  it("returns the original payment when the same event is delivered twice", async () => {
    const idempotency = {
      find: vi.fn().mockResolvedValue({ resultId: "pay_1" }),
      reserve: vi.fn(),
      complete: vi.fn(),
      release: vi.fn(),
    };
    const handler = new StripeWebhookHandler(stripeStub(), idempotency as never, paymentsStub());

    const response = responseStub();
    await handler.handle(requestStub(), response);

    expect(idempotency.reserve).not.toHaveBeenCalled();
    expect(response.body).toEqual({ status: "duplicate", paymentId: "pay_1" });
  });

  it("responds 409 while a concurrent delivery holds the reservation", async () => {
    const idempotency = {
      find: vi.fn().mockResolvedValue(null),
      reserve: vi.fn().mockResolvedValue({ acquired: false }),
      complete: vi.fn(),
      release: vi.fn(),
    };
    const handler = new StripeWebhookHandler(stripeStub(), idempotency as never, paymentsStub());

    const response = responseStub();
    await handler.handle(requestStub(), response);

    expect(response.statusCode).toBe(409);
  });
});
`,
  4,
);

// ---------------------------------------------------------------------------
// Documentation, rules and project metadata.
// ---------------------------------------------------------------------------

const ARCHITECTURE = `# Architecture

The service is a payment gateway in front of Stripe.

## Layers

- \`src/payment\` — webhook handling, idempotency, persistence
- \`src/stripe\` — the only module allowed to talk to the Stripe SDK
- \`src/platform\` — database, config, logging
- \`src/camera\`, \`src/signage\`, \`src/kiosk\` — unrelated store-hardware services

## Idempotency

Stripe retries webhook deliveries. Every webhook is processed under a
reservation held in \`idempotency_keys\`, keyed by the Stripe event id. A
duplicate delivery must return the original result rather than creating a
second Payment.

Concurrent deliveries of the same event resolve as: the first caller acquires
the reservation, later callers receive 409 and Stripe retries.

## Constraints

- No module outside \`src/stripe\` may import the Stripe SDK.
- No module outside \`src/platform\` may open a database connection.
- The frontend must never access the database directly.
`;

add("docs/architecture.md", ARCHITECTURE, 12);

// A near-duplicate of the architecture document — the copy-paste kind that
// really accumulates in repositories: same body, different title. It is older,
// so deduplication should keep `architecture.md` and drop this one.
add(
  "docs/architecture-overview.md",
  ARCHITECTURE.replace("# Architecture\n", "# Architecture Overview\n"),
  40,
);

add(
  "docs/rules.md",
  `---
priority: P0
---

# Project rules

These rules are binding. A change that violates one is wrong even if the tests
pass.

1. A duplicate Stripe event must never create a second Payment record.
2. Only \`src/stripe\` may import the Stripe SDK.
3. Only \`src/platform\` may open database connections.
4. The frontend must not access the database directly.
5. Webhook handlers must be idempotent and must not block on external calls.
6. Secrets are read from configuration, never hard-coded and never logged.
`,
  20,
);

add(
  "docs/runbook.md",
  `# Runbook

## Stripe webhook backlog

Symptoms: rising \`webhook_queue_depth\`, Stripe dashboard shows retries.

1. Check \`idempotency_keys\` for rows stuck in \`reserved\`.
2. Expire stale reservations older than the retry window.
3. Confirm the signature secret matches the Stripe dashboard.

## Card terminal offline

Unrelated to the payment API; see the kiosk runbook.
`,
  30,
);

add(
  "docs/onboarding.md",
  `# Onboarding

Install dependencies, copy \`.env.example\`, run the migrations, start the dev
server. The store-hardware services (camera, signage, kiosk) are not needed for
payment work and can be left stopped.
`,
  60,
);

add(
  "project.md",
  `# Payments service

Handles card payments for the retail platform. Stripe is the payment provider.
Owned by the payments team.
`,
  25,
);

add(
  "README.md",
  `# payments-service

Payment gateway in front of Stripe.

\`\`\`bash
pnpm install
pnpm migrate
pnpm dev
\`\`\`

See docs/architecture.md for the layering rules.
`,
  25,
);

add(
  "package.json",
  `{
  "name": "payments-service",
  "version": "2.4.1",
  "type": "module",
  "dependencies": {
    "express": "^4.19.2",
    "stripe": "^16.2.0",
    "pg": "^8.12.0"
  }
}
`,
  25,
);

// ---------------------------------------------------------------------------
// ctxd memory records with mixed priorities.
// ---------------------------------------------------------------------------

const memories: [string, string, string, string, number][] = [
  [
    "duplicate-payments-incident",
    "P0",
    "Duplicate payments incident",
    `A Stripe retry storm in March created 42 duplicate Payment rows because the
webhook handler checked for an existing payment without holding a reservation.
The fix was the unique index on \`idempotency_keys.key\` plus the reserve/complete
protocol. Do not replace the reservation with a plain SELECT-then-INSERT.`,
    90,
  ],
  [
    "decision-42-idempotency",
    "P1",
    "Decision #42 — idempotency keyed by Stripe event id",
    `Question: what should the idempotency key be for webhook processing?
Decision: the Stripe event id, not the payment intent id.
Reason: one payment intent produces several events; keying on the intent would
collapse distinct events. Status: ACTIVE.`,
    75,
  ],
  [
    "stripe-api-version",
    "P2",
    "Stripe API version is pinned",
    `The adapter pins apiVersion 2024-06-20. Upgrading changes the webhook event
payload shape and requires re-testing the webhook handler.`,
    50,
  ],
  [
    "signage-firmware",
    "P3",
    "Signage firmware rollout",
    `The signage fleet runs firmware 4.2. Rollouts happen on Tuesdays. Unrelated to
payments.`,
    120,
  ],
  [
    "old-queue-migration",
    "P4",
    "Legacy queue migration (completed)",
    `The old RabbitMQ webhook queue was removed in 2024. Historical note only.`,
    300,
  ],
];

for (const [slug, priority, title, body, ageDays] of memories) {
  add(
    `.ctxd/memory/${slug}.md`,
    `---
priority: ${priority}
type: MEMORY
---

# ${title}

${body}
`,
    ageDays,
  );
}

// ---------------------------------------------------------------------------
// Stale sessions — bulky, low value, exactly what the firewall should drop.
// ---------------------------------------------------------------------------

for (let i = 1; i <= 3; i += 1) {
  const lines: string[] = [
    `# Session ${i}`,
    "",
    `Date: 2026-0${i}-14`,
    "",
    "## Transcript",
    "",
  ];
  for (let j = 0; j < 120; j += 1) {
    lines.push(
      `- [${String(j).padStart(3, "0")}] Discussed the signage rollout schedule and the kiosk`,
      `  firmware queue; no decisions recorded. Reviewed dashboard metrics for the`,
      `  camera fleet and confirmed the nightly export completed successfully.`,
    );
  }
  add(`.ctxd/sessions/session-${i}.md`, `${lines.join("\n")}\n`, 100 + i * 30);
}

// ---------------------------------------------------------------------------
// Unrelated modules — the bulk that must be excluded.
// ---------------------------------------------------------------------------

interface BulkModule {
  readonly dir: string;
  readonly name: string;
  readonly domain: string;
  readonly entity: string;
}

const bulk: BulkModule[] = [
  { dir: "camera", name: "stream", domain: "camera", entity: "CameraStream" },
  { dir: "camera", name: "recorder", domain: "camera", entity: "Recorder" },
  { dir: "camera", name: "motion-detector", domain: "camera", entity: "MotionDetector" },
  { dir: "signage", name: "device", domain: "signage", entity: "SignageDevice" },
  { dir: "signage", name: "playlist", domain: "signage", entity: "Playlist" },
  { dir: "signage", name: "scheduler", domain: "signage", entity: "SignageScheduler" },
  { dir: "kiosk", name: "session", domain: "kiosk", entity: "KioskSession" },
  { dir: "kiosk", name: "printer", domain: "kiosk", entity: "ReceiptPrinter" },
  { dir: "inventory", name: "stock-level", domain: "inventory", entity: "StockLevel" },
  { dir: "inventory", name: "reorder", domain: "inventory", entity: "ReorderPolicy" },
  { dir: "inventory", name: "supplier", domain: "inventory", entity: "Supplier" },
  { dir: "analytics", name: "footfall", domain: "analytics", entity: "FootfallReport" },
  { dir: "analytics", name: "dwell-time", domain: "analytics", entity: "DwellTime" },
  { dir: "loyalty", name: "points", domain: "loyalty", entity: "PointsLedger" },
  { dir: "loyalty", name: "tier", domain: "loyalty", entity: "TierPolicy" },
  { dir: "scheduling", name: "shift", domain: "scheduling", entity: "Shift" },
  { dir: "scheduling", name: "roster", domain: "scheduling", entity: "Roster" },
  { dir: "facilities", name: "hvac", domain: "facilities", entity: "HvacUnit" },
];

/** A plausible service module with no bearing on Stripe or idempotency. */
function bulkModule(module: BulkModule): string {
  const { domain, entity } = module;
  const lines: string[] = [
    `import { Database } from "../platform/database.js";`,
    `import { logger } from "../platform/logger.js";`,
    ``,
    `/** ${entity} management for the ${domain} subsystem. */`,
    `export interface ${entity}Record {`,
    `  id: string;`,
    `  siteId: string;`,
    `  label: string;`,
    `  state: "active" | "idle" | "faulted";`,
    `  updatedAt: Date;`,
    `}`,
    ``,
    `export class ${entity}Service {`,
    `  constructor(private readonly db: Database) {}`,
    ``,
  ];

  const operations = [
    "list", "findById", "create", "update", "archive", "restore",
    "countBySite", "markFaulted", "markHealthy", "refreshCache",
    "exportReport", "importBatch",
  ];

  for (const operation of operations) {
    lines.push(
      `  /** ${operation} for ${domain} ${entity} records. */`,
      `  async ${operation}(siteId: string, payload: Record<string, unknown> = {}): Promise<${entity}Record[]> {`,
      `    logger.debug("${domain}.${operation}", { siteId, payload });`,
      `    const rows = await this.db.query<${entity}Record>(`,
      `      "SELECT id, site_id AS siteId, label, state, updated_at AS updatedAt " +`,
      `        "FROM ${domain}_${module.name.replace(/-/g, "_")} WHERE site_id = $1 ORDER BY label",`,
      `      [siteId],`,
      `    );`,
      `    return rows.filter((row) => row.state !== "faulted" || payload["includeFaulted"] === true);`,
      `  }`,
      ``,
    );
  }

  lines.push(
    `  private describe(record: ${entity}Record): string {`,
    `    return \`\${record.label} (\${record.state}) at site \${record.siteId}\`;`,
    `  }`,
    `}`,
    ``,
  );

  return lines.join("\n");
}

for (const module of bulk) {
  add(`src/${module.dir}/${module.name}.ts`, bulkModule(module), 45);
}

// Platform modules: referenced by the relevant files, mildly useful context.
add(
  "src/platform/database.ts",
  `import pg from "pg";
import { config } from "./config.js";

/** The only module permitted to open a database connection. */
export class Database {
  private readonly pool = new pg.Pool({ connectionString: config.database.url });

  async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const result = await this.pool.query(sql, params);
    return result.rows as T[];
  }

  async queryOne<T>(sql: string, params: unknown[] = []): Promise<T> {
    const rows = await this.query<T>(sql, params);
    return rows[0] as T;
  }

  async execute(sql: string, params: unknown[] = []): Promise<{ rowCount: number }> {
    const result = await this.pool.query(sql, params);
    return { rowCount: result.rowCount ?? 0 };
  }
}
`,
  35,
);

add(
  "src/platform/logger.ts",
  `export const logger = {
  debug: (msg: string, fields?: unknown) => emit("debug", msg, fields),
  info: (msg: string, fields?: unknown) => emit("info", msg, fields),
  error: (msg: string, fields?: unknown) => emit("error", msg, fields),
};

function emit(level: string, msg: string, fields?: unknown): void {
  process.stdout.write(\`\${JSON.stringify({ level, msg, fields })}\\n\`);
}
`,
  35,
);

add(
  "src/platform/config.ts",
  `export const config = {
  stripe: {
    apiKey: process.env["STRIPE_API_KEY"] ?? "",
    webhookSecret: process.env["STRIPE_WEBHOOK_SECRET"] ?? "",
  },
  database: { url: process.env["DATABASE_URL"] ?? "" },
};
`,
  35,
);

// A secret file that must never be collected.
add(
  ".env",
  "STRIPE_API_KEY=fixture-not-a-real-key\nDATABASE_URL=postgres://fixture/db\n",
  10,
);

// ---------------------------------------------------------------------------
// Write everything.
// ---------------------------------------------------------------------------

rmSync(ROOT, { recursive: true, force: true });

for (const file of files) {
  const absolute = join(ROOT, file.path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, file.content);

  const seconds = (NOW - file.ageDays * DAY) / 1000;
  utimesSync(absolute, seconds, seconds);
}

process.stdout.write(`wrote ${files.length} files to ${ROOT}\n`);
