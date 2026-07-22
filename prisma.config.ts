import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

if (!process.env.DATABASE_URL && process.env.NODE_ENV !== "production") {
  const sqlitePath = path.resolve("prisma/dev.db").replace(/\\/g, "/");
  process.env.DATABASE_URL = `file:${sqlitePath}`;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
