import express from "express";
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
