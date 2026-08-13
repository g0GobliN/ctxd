/**
 * The remaining §26 benchmark scenarios.
 *
 * Each is chosen to stress a different property of retrieval that the first
 * three do not:
 *
 *   database-migration — the answer is an *ordered* set of files, and the
 *                        newest migration matters more than an older one, so
 *                        recency has to count for something without drowning
 *                        relevance.
 *   payment-flow       — a feature spanning several modules rather than a bug
 *                        in one, so a build that only finds the single
 *                        best-matching file fails.
 *   api-refactor       — a legitimately broad task. It exists to check the
 *                        engine does not punish breadth that was asked for.
 *   frontend-bug       — component and stylesheet vocabulary, where the fix is
 *                        in a `.tsx` and a `.css` rather than in service code.
 *
 * Usage: node --experimental-strip-types scripts/generate-benchmarks-2.ts
 */

import { addBulk, addPlatform, Fixture, writeBenchmarkDefinition } from "./fixture-kit.ts";

/* ------------------------------------------------------------------------ */
/* database-migration                                                        */
/* ------------------------------------------------------------------------ */

function databaseMigration(): void {
  const fixture = new Fixture("database-migration");

  // Older migrations: plausible, and mostly not what the task needs.
  const older = [
    ["001_create_users", "users", "email TEXT NOT NULL UNIQUE"],
    ["002_create_orders", "orders", "user_id TEXT NOT NULL REFERENCES users(id)"],
    ["003_create_products", "products", "sku TEXT NOT NULL UNIQUE"],
    ["004_add_order_status", "orders", "status TEXT NOT NULL DEFAULT 'pending'"],
    ["005_create_shipments", "shipments", "order_id TEXT NOT NULL REFERENCES orders(id)"],
    ["006_add_product_price", "products", "price_cents INTEGER NOT NULL DEFAULT 0"],
  ] as const;

  older.forEach(([name, table, column], index) => {
    fixture.add(
      `migrations/${name}.sql`,
      `-- ${name.replace(/^\d+_/, "").replace(/_/g, " ")}\n` +
        `ALTER TABLE ${table} ADD COLUMN ${column};\n`,
      60 - index * 5,
    );
  });

  fixture.add(
    "migrations/007_split_customer_name.sql",
    `-- Split customers.name into given_name and family_name.
--
-- This migration is expand-only on purpose: it adds the new columns and
-- backfills them, but does NOT drop customers.name. The old column is removed
-- by migration 009, after every reader has shipped. See docs/migrations.md.
ALTER TABLE customers ADD COLUMN given_name TEXT;
ALTER TABLE customers ADD COLUMN family_name TEXT;

UPDATE customers
   SET given_name  = substr(name, 1, instr(name, ' ') - 1),
       family_name = substr(name, instr(name, ' ') + 1)
 WHERE name LIKE '% %' AND given_name IS NULL;
`,
    2,
  );

  fixture.add(
    "migrations/008_backfill_customer_name.sql",
    `-- Backfill the rows migration 007 could not split (single-word names).
UPDATE customers
   SET given_name = name, family_name = ''
 WHERE given_name IS NULL;
`,
    1,
  );

  fixture.add(
    "src/database/migrator.ts",
    `import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Database } from "../platform/database.js";

/**
 * Migration runner.
 *
 * Migrations are append-only and run in filename order inside a single
 * transaction each. A migration is never rewritten once it has run anywhere:
 * the recorded version is the contract, and editing history would leave two
 * databases claiming the same version with different schemas.
 */
export class Migrator {
  constructor(private readonly db: Database, private readonly dir: string) {}

  async currentVersion(): Promise<number> {
    const rows = await this.db.query<{ version: number }>(
      "SELECT version FROM schema_meta ORDER BY version DESC LIMIT 1",
    );
    return rows[0]?.version ?? 0;
  }

  async pending(): Promise<string[]> {
    const applied = await this.currentVersion();
    return readdirSync(this.dir)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .filter((name) => Number.parseInt(name.slice(0, 3), 10) > applied);
  }

  async run(): Promise<void> {
    for (const name of await this.pending()) {
      const sql = readFileSync(join(this.dir, name), "utf8");
      await this.db.query("BEGIN");
      await this.db.query(sql);
      await this.db.query("INSERT INTO schema_meta (version) VALUES ($1)", [
        Number.parseInt(name.slice(0, 3), 10),
      ]);
      await this.db.query("COMMIT");
    }
  }
}
`,
    4,
  );

  fixture.addDoc(
    "docs/migrations.md",
    "P1",
    "Migration policy",
    `Every schema change ships as three migrations, not one:

1. **Expand** — add the new shape, leave the old one in place.
2. **Backfill** — populate the new shape for existing rows.
3. **Contract** — drop the old shape, only once every reader has shipped.

A migration that expands and contracts in one step breaks any process still
running the previous release, which during a rolling deploy is all of them.

Migrations are append-only. Never edit one that has run anywhere.`,
    10,
  );

  fixture.addDoc(
    "docs/rules.md",
    "P0",
    "Project rules",
    `These rules are binding.

1. A migration must never expand and contract in the same step.
2. Migrations are append-only. Never edit one that has already run.
3. Every migration runs inside a transaction.
4. Only \`src/platform\` and \`src/database\` may open database connections.`,
    20,
  );

  fixture.addMemory(
    "migration-006-outage",
    "P1",
    "BUG #12 — migration 006 caused a deploy outage",
    `Problem: dropping products.price in the same migration that added
price_cents took the checkout API down for eleven minutes.

Cause: the old release was still reading products.price during the rolling
deploy.

Fix: expand, backfill, contract — as three separate migrations. This is why
docs/migrations.md exists.

Status: RESOLVED.`,
    30,
  );

  fixture.add("src/platform/config.ts", `export const config = {\n  database: { url: process.env["DATABASE_URL"] ?? "" },\n};\n`, 35);
  addPlatform(fixture);
  addBulk(
    fixture,
    [
      { dir: "reporting", domain: "reporting", entity: "Report" },
      { dir: "marketing", domain: "marketing", entity: "Campaign" },
      { dir: "support", domain: "support", entity: "Ticket" },
      { dir: "logistics", domain: "logistics", entity: "Shipment" },
      { dir: "telemetry", domain: "telemetry", entity: "Reading" },
      { dir: "facilities", domain: "facilities", entity: "Asset" },
    ],
    9,
  );
  fixture.addSecret("DATABASE_URL=postgres://fixture/db\n");

  const root = fixture.write();
  writeBenchmarkDefinition({
    name: "database-migration",
    task: "Split the customer name column into given and family name",
    budget: 10000,
    minCandidateTokens: 50000,
    mustInclude: ["migrations/007_split_customer_name.sql", "docs/rules.md"],
    shouldInclude: ["docs/migrations.md", "migrations/008_backfill_customer_name.sql"],
    mustExclude: [
      "src/marketing/marketing-module-1.ts",
      "src/support/support-module-1.ts",
      "src/telemetry/telemetry-module-1.ts",
      ".env",
    ],
    mustDeduplicate: [],
  });
  process.stdout.write(`database-migration: ${fixture.count} files → ${root}\n`);
}

/* ------------------------------------------------------------------------ */
/* payment-flow                                                              */
/* ------------------------------------------------------------------------ */

function paymentFlow(): void {
  const fixture = new Fixture("payment-flow");

  // The feature genuinely spans four modules. A build that finds only the
  // best-matching one has failed, which is the point of this scenario.
  fixture.add(
    "src/checkout/cart.ts",
    `import { PricingService } from "./pricing.js";

/** The cart a customer is checking out. Totals are always recomputed here. */
export interface CartLine {
  sku: string;
  quantity: number;
  unitPriceCents: number;
}

export class Cart {
  constructor(private readonly pricing: PricingService) {}

  async total(lines: CartLine[], currency: string): Promise<number> {
    const subtotal = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
    return this.pricing.applyTaxAndDiscounts(subtotal, currency);
  }
}
`,
    5,
  );

  fixture.add(
    "src/checkout/pricing.ts",
    `/** Tax and discount rules for the checkout flow. */
export class PricingService {
  async applyTaxAndDiscounts(subtotalCents: number, currency: string): Promise<number> {
    const rate = currency === "GBP" ? 0.2 : 0;
    return Math.round(subtotalCents * (1 + rate));
  }
}
`,
    7,
  );

  fixture.add(
    "src/checkout/order.ts",
    `import { Cart, type CartLine } from "./cart.js";
import { PaymentGateway } from "../payment/gateway.js";
import { OrderRepository } from "./order-repository.js";

/**
 * Places an order: price the cart, take payment, then record the order.
 *
 * Order matters. Recording before the charge succeeds would leave an order with
 * no payment if the gateway declines, which is worse than the reverse — a
 * charge with no order can be reconciled, an order with no charge ships goods.
 */
export class Checkout {
  constructor(
    private readonly cart: Cart,
    private readonly gateway: PaymentGateway,
    private readonly orders: OrderRepository,
  ) {}

  async place(customerId: string, lines: CartLine[], currency: string): Promise<string> {
    const total = await this.cart.total(lines, currency);
    const charge = await this.gateway.charge(customerId, total, currency);
    if (!charge.succeeded) throw new Error(\`payment declined: \${charge.reason}\`);
    return this.orders.create(customerId, lines, total, charge.id);
  }
}
`,
    3,
  );

  fixture.add(
    "src/payment/gateway.ts",
    `import { config } from "../platform/config.js";

/** The payment gateway adapter. Only this module may talk to the provider. */
export interface ChargeResult {
  id: string;
  succeeded: boolean;
  reason: string | null;
}

export class PaymentGateway {
  async charge(customerId: string, amountCents: number, currency: string): Promise<ChargeResult> {
    if (amountCents <= 0) return { id: "", succeeded: false, reason: "non-positive amount" };
    const reference = \`\${customerId}:\${amountCents}:\${currency}\`;
    return { id: \`ch_\${Buffer.from(reference).toString("hex").slice(0, 16)}\`, succeeded: true, reason: null };
  }

  get provider(): string {
    return config.payment.provider;
  }
}
`,
    6,
  );

  fixture.add(
    "src/checkout/order-repository.ts",
    `import { Database } from "../platform/database.js";
import type { CartLine } from "./cart.js";

/** Order persistence. */
export class OrderRepository {
  constructor(private readonly db: Database) {}

  async create(customerId: string, lines: CartLine[], totalCents: number, chargeId: string): Promise<string> {
    const rows = await this.db.query<{ id: string }>(
      "INSERT INTO orders (customer_id, total_cents, charge_id) VALUES ($1, $2, $3) RETURNING id",
      [customerId, totalCents, chargeId],
    );
    const id = rows[0]?.id ?? "";
    for (const line of lines) {
      await this.db.query(
        "INSERT INTO order_lines (order_id, sku, quantity, unit_price_cents) VALUES ($1, $2, $3, $4)",
        [id, line.sku, line.quantity, line.unitPriceCents],
      );
    }
    return id;
  }
}
`,
    8,
  );

  fixture.addDoc(
    "docs/rules.md",
    "P0",
    "Project rules",
    `These rules are binding.

1. Payment must be taken before an order is recorded. An order with no charge
   ships goods; a charge with no order can be reconciled.
2. Only \`src/payment\` may talk to the payment provider.
3. Money is integer cents. Never a float.
4. Only \`src/platform\` may open database connections.`,
    20,
  );

  fixture.addMemory(
    "decision-31-charge-before-order",
    "P1",
    "Decision #31 — charge before recording the order",
    `Question: should the order row be written before or after the charge?

Decision: after.

Reason: a declined charge must not leave a recorded order. The reverse failure —
a charge with no order — is recoverable by reconciliation.

Status: ACTIVE.`,
    25,
  );

  fixture.add("src/platform/config.ts", `export const config = {\n  payment: { provider: "stripe", apiKey: process.env["PAYMENT_API_KEY"] ?? "" },\n  database: { url: process.env["DATABASE_URL"] ?? "" },\n};\n`, 35);
  addPlatform(fixture);
  addBulk(
    fixture,
    [
      { dir: "warehouse", domain: "warehouse", entity: "Bin" },
      { dir: "signage", domain: "signage", entity: "Display" },
      { dir: "hr", domain: "hr", entity: "Employee" },
      { dir: "fleet", domain: "fleet", entity: "Vehicle" },
      { dir: "energy", domain: "energy", entity: "Meter" },
      { dir: "compliance", domain: "compliance", entity: "Audit" },
    ],
    9,
  );
  fixture.addSecret("PAYMENT_API_KEY=fixture-not-a-real-key\nDATABASE_URL=postgres://fixture/db\n");

  const root = fixture.write();
  writeBenchmarkDefinition({
    name: "payment-flow",
    task: "Trace the checkout payment flow from cart total to recorded order",
    budget: 10000,
    minCandidateTokens: 50000,
    // The whole flow, not just the closest match.
    mustInclude: ["src/checkout/order.ts", "docs/rules.md"],
    shouldInclude: [
      "src/checkout/cart.ts",
      "src/payment/gateway.ts",
      "src/checkout/order-repository.ts",
    ],
    mustExclude: [
      "src/warehouse/warehouse-module-1.ts",
      "src/hr/hr-module-1.ts",
      "src/energy/energy-module-1.ts",
      ".env",
    ],
    mustDeduplicate: [],
  });
  process.stdout.write(`payment-flow: ${fixture.count} files → ${root}\n`);
}

/* ------------------------------------------------------------------------ */
/* api-refactor                                                              */
/* ------------------------------------------------------------------------ */

function apiRefactor(): void {
  const fixture = new Fixture("api-refactor");

  const handlers = [
    ["users", "User"],
    ["orders", "Order"],
    ["products", "Product"],
    ["invoices", "Invoice"],
    ["shipments", "Shipment"],
  ] as const;

  for (const [name, entity] of handlers) {
    fixture.add(
      `src/api/handlers/${name}.ts`,
      `import type { Request, Response } from "express";
import { ${entity}Service } from "../../services/${name}.js";

/**
 * ${entity} HTTP handlers.
 *
 * Every handler repeats the same shape: parse, validate, call the service,
 * translate errors to status codes. Extracting that repetition into a shared
 * router helper is the refactor this codebase needs.
 */
export function register${entity}Routes(service: ${entity}Service) {
  return {
    async list(request: Request, response: Response): Promise<void> {
      try {
        const page = Number.parseInt(String(request.query["page"] ?? "1"), 10);
        if (!Number.isInteger(page) || page < 1) {
          response.status(400).json({ error: "page must be a positive integer" });
          return;
        }
        response.json(await service.list(page));
      } catch (error) {
        response.status(500).json({ error: (error as Error).message });
      }
    },

    async get(request: Request, response: Response): Promise<void> {
      try {
        const id = String(request.params["id"] ?? "");
        if (id === "") {
          response.status(400).json({ error: "id is required" });
          return;
        }
        const found = await service.get(id);
        if (found === undefined) {
          response.status(404).json({ error: "not found" });
          return;
        }
        response.json(found);
      } catch (error) {
        response.status(500).json({ error: (error as Error).message });
      }
    },
  };
}
`,
      6,
    );

    fixture.add(
      `src/services/${name}.ts`,
      `import { Database } from "../platform/database.js";

export interface ${entity}Row {
  id: string;
  createdAt: string;
}

export class ${entity}Service {
  constructor(private readonly db: Database) {}

  async list(page: number): Promise<${entity}Row[]> {
    return this.db.query<${entity}Row>(
      "SELECT id, created_at AS createdAt FROM ${name} ORDER BY created_at DESC LIMIT 50 OFFSET $1",
      [(page - 1) * 50],
    );
  }

  async get(id: string): Promise<${entity}Row | undefined> {
    const rows = await this.db.query<${entity}Row>(
      "SELECT id, created_at AS createdAt FROM ${name} WHERE id = $1",
      [id],
    );
    return rows[0];
  }
}
`,
      9,
    );
  }

  fixture.add(
    "src/api/router.ts",
    `import express from "express";
import { registerUserRoutes } from "./handlers/users.js";
import { registerOrderRoutes } from "./handlers/orders.js";
import { registerProductRoutes } from "./handlers/products.js";
import { registerInvoiceRoutes } from "./handlers/invoices.js";
import { registerShipmentRoutes } from "./handlers/shipments.js";

/** Wires every handler onto the HTTP router. */
export function buildRouter(services: Record<string, never>): express.Router {
  const router = express.Router();
  void registerUserRoutes;
  void registerOrderRoutes;
  void registerProductRoutes;
  void registerInvoiceRoutes;
  void registerShipmentRoutes;
  void services;
  return router;
}
`,
    5,
  );

  fixture.addDoc(
    "docs/api-conventions.md",
    "P1",
    "API conventions",
    `Every handler follows the same contract:

- \`400\` for a malformed request, with the offending field named
- \`404\` when the entity does not exist
- \`500\` only for genuinely unexpected failures

The repetition across handlers is deliberate duplication, not an accident — it
was left in place until there were enough handlers to see the right shared
shape. There are five now.`,
    12,
  );

  fixture.addDoc(
    "docs/rules.md",
    "P0",
    "Project rules",
    `These rules are binding.

1. A handler must never talk to the database directly; it goes through a service.
2. Error status codes follow docs/api-conventions.md.
3. Only \`src/platform\` may open database connections.`,
    20,
  );

  addPlatform(fixture);
  fixture.add("src/platform/config.ts", `export const config = {\n  database: { url: process.env["DATABASE_URL"] ?? "" },\n};\n`, 35);
  addBulk(
    fixture,
    [
      { dir: "analytics", domain: "analytics", entity: "Metric" },
      { dir: "signage", domain: "signage", entity: "Display" },
      { dir: "facilities", domain: "facilities", entity: "Asset" },
      { dir: "fleet", domain: "fleet", entity: "Vehicle" },
      { dir: "kiosk", domain: "kiosk", entity: "Terminal" },
    ],
    8,
  );
  fixture.addSecret("DATABASE_URL=postgres://fixture/db\n");

  const root = fixture.write();
  writeBenchmarkDefinition({
    name: "api-refactor",
    task: "Refactor the API handlers to share one request validation helper",
    budget: 12000,
    minCandidateTokens: 50000,
    mustInclude: ["docs/rules.md"],
    shouldInclude: ["docs/api-conventions.md", "src/api/handlers/users.ts"],
    mustExclude: [
      "src/signage/signage-module-1.ts",
      "src/fleet/fleet-module-1.ts",
      "src/facilities/facilities-module-1.ts",
      ".env",
    ],
    mustDeduplicate: [],
  });
  process.stdout.write(`api-refactor: ${fixture.count} files → ${root}\n`);
}

/* ------------------------------------------------------------------------ */
/* frontend-bug                                                              */
/* ------------------------------------------------------------------------ */

function frontendBug(): void {
  const fixture = new Fixture("frontend-bug");

  fixture.add(
    "src/components/DatePicker.tsx",
    `import { useEffect, useRef, useState } from "react";
import "./DatePicker.css";

/**
 * Date picker.
 *
 * The popup is positioned against the input rather than the viewport, which is
 * why it clips inside a scrolling container — the container establishes a new
 * containing block and the absolute offsets are computed against the wrong one.
 */
export function DatePicker(props: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || anchor.current === null) return;
    const rect = anchor.current.getBoundingClientRect();
    anchor.current.style.setProperty("--popup-top", \`\${rect.bottom}px\`);
    anchor.current.style.setProperty("--popup-left", \`\${rect.left}px\`);
  }, [open]);

  return (
    <div className="date-picker" ref={anchor}>
      <input
        className="date-picker__input"
        value={props.value}
        onFocus={() => setOpen(true)}
        onChange={(event) => props.onChange(event.target.value)}
      />
      {open && <div className="date-picker__popup" role="dialog" />}
    </div>
  );
}
`,
    2,
  );

  fixture.add(
    "src/components/DatePicker.css",
    `.date-picker {
  position: relative;
}

/*
 * The popup is absolutely positioned against .date-picker. Inside a scrolling
 * container this clips, because overflow on the ancestor establishes a new
 * containing block. Fixing it means positioning against the viewport, or
 * portalling the popup out of the scroll container entirely.
 */
.date-picker__popup {
  position: absolute;
  top: var(--popup-top);
  left: var(--popup-left);
  z-index: 10;
  min-width: 260px;
}

.date-picker__input {
  width: 100%;
  padding: 8px 10px;
}
`,
    2,
  );

  fixture.add(
    "src/components/ScrollPanel.tsx",
    `import type { ReactNode } from "react";
import "./ScrollPanel.css";

/** A scrolling container. Anything absolutely positioned inside it will clip. */
export function ScrollPanel(props: { children: ReactNode }) {
  return <div className="scroll-panel">{props.children}</div>;
}
`,
    6,
  );

  fixture.add(
    "src/components/ScrollPanel.css",
    `.scroll-panel {
  overflow-y: auto;
  max-height: 420px;
}
`,
    6,
  );

  fixture.add(
    "src/pages/BookingForm.tsx",
    `import { DatePicker } from "../components/DatePicker.js";
import { ScrollPanel } from "../components/ScrollPanel.js";
import { useState } from "react";

/** The booking form — where the clipped date picker was first reported. */
export function BookingForm() {
  const [date, setDate] = useState("");
  return (
    <ScrollPanel>
      <h1>Book a room</h1>
      <DatePicker value={date} onChange={setDate} />
    </ScrollPanel>
  );
}
`,
    3,
  );

  fixture.addDoc(
    "docs/rules.md",
    "P0",
    "Project rules",
    `These rules are binding.

1. A component must not set inline styles except for measured positions.
2. Every interactive element must be reachable by keyboard.
3. Component styles live beside the component, never in a global stylesheet.`,
    20,
  );

  fixture.addMemory(
    "popup-clipping-history",
    "P1",
    "BUG #57 — popups clip inside scrolling containers",
    `Problem: the select menu clipped inside the settings panel, exactly as the
date picker now does in the booking form.

Cause: absolute positioning inside an ancestor with overflow. The ancestor
establishes a new containing block, so the offsets are measured against the
wrong element.

Fix: the select menu was portalled to the document body and positioned against
the viewport. The date picker was never migrated.

Status: RESOLVED for the select menu only.`,
    22,
  );

  addPlatform(fixture);
  fixture.add("src/platform/config.ts", `export const config = { api: { url: process.env["API_URL"] ?? "" } };\n`, 35);
  addBulk(
    fixture,
    [
      { dir: "billing", domain: "billing", entity: "Invoice" },
      { dir: "inventory", domain: "inventory", entity: "StockItem" },
      { dir: "reporting", domain: "reporting", entity: "Report" },
      { dir: "logistics", domain: "logistics", entity: "Shipment" },
      { dir: "support", domain: "support", entity: "Ticket" },
      { dir: "hr", domain: "hr", entity: "Employee" },
    ],
    9,
  );
  fixture.addSecret("API_URL=https://fixture.invalid\nSESSION_SECRET=fixture-not-a-real-secret\n");

  const root = fixture.write();
  writeBenchmarkDefinition({
    name: "frontend-bug",
    task: "Fix the date picker popup clipping inside a scrolling panel",
    budget: 10000,
    minCandidateTokens: 50000,
    mustInclude: ["src/components/DatePicker.tsx", "docs/rules.md"],
    shouldInclude: ["src/components/DatePicker.css", "src/components/ScrollPanel.css"],
    mustExclude: [
      "src/billing/billing-module-1.ts",
      "src/hr/hr-module-1.ts",
      "src/support/support-module-1.ts",
      ".env",
    ],
    mustDeduplicate: [],
  });
  process.stdout.write(`frontend-bug: ${fixture.count} files → ${root}\n`);
}

databaseMigration();
paymentFlow();
apiRefactor();
frontendBug();
