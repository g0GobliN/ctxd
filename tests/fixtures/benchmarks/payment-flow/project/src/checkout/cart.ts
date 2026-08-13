import { PricingService } from "./pricing.js";

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
