import type { Request, Response } from "express";
import { InvoiceService } from "../../services/invoices.js";

/**
 * Invoice HTTP handlers.
 *
 * Every handler repeats the same shape: parse, validate, call the service,
 * translate errors to status codes. Extracting that repetition into a shared
 * router helper is the refactor this codebase needs.
 */
export function registerInvoiceRoutes(service: InvoiceService) {
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
