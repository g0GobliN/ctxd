import Stripe from "stripe";
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
