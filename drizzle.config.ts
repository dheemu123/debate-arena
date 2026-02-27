import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Load .env.local (Next.js convention) if dotenv didn't pick it up
import { config } from "dotenv";
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
