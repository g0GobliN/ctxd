import type { Request, Response } from "express";
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
