export const config = {
  stripe: {
    apiKey: process.env["STRIPE_API_KEY"] ?? "",
    webhookSecret: process.env["STRIPE_WEBHOOK_SECRET"] ?? "",
  },
  database: { url: process.env["DATABASE_URL"] ?? "" },
};
