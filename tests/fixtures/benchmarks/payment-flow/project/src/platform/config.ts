export const config = {
  payment: { provider: "stripe", apiKey: process.env["PAYMENT_API_KEY"] ?? "" },
  database: { url: process.env["DATABASE_URL"] ?? "" },
};
