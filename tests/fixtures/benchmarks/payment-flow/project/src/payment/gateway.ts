import { config } from "../platform/config.js";

/** The payment gateway adapter. Only this module may talk to the provider. */
export interface ChargeResult {
  id: string;
  succeeded: boolean;
  reason: string | null;
}

export class PaymentGateway {
  async charge(customerId: string, amountCents: number, currency: string): Promise<ChargeResult> {
    if (amountCents <= 0) return { id: "", succeeded: false, reason: "non-positive amount" };
    const reference = `${customerId}:${amountCents}:${currency}`;
    return { id: `ch_${Buffer.from(reference).toString("hex").slice(0, 16)}`, succeeded: true, reason: null };
  }

  get provider(): string {
    return config.payment.provider;
  }
}
