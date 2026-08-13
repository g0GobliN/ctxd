import { describe, expect, it, vi } from "vitest";
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
