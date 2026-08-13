export const config = {
  auth: {
    jwtSecret: process.env["JWT_SECRET"] ?? "",
    accessTokenSeconds: 900,
  },
  database: { url: process.env["DATABASE_URL"] ?? "" },
};
