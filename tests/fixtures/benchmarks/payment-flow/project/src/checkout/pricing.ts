/** Tax and discount rules for the checkout flow. */
export class PricingService {
  async applyTaxAndDiscounts(subtotalCents: number, currency: string): Promise<number> {
    const rate = currency === "GBP" ? 0.2 : 0;
    return Math.round(subtotalCents * (1 + rate));
  }
}
