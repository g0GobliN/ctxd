import { Cart, type CartLine } from "./cart.js";
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
    if (!charge.succeeded) throw new Error(`payment declined: ${charge.reason}`);
    return this.orders.create(customerId, lines, total, charge.id);
  }
}
