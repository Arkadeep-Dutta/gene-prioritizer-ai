import { PrismaClient } from "@prisma/client";

import { readDatabaseEnvironment } from "@/lib/db/env";

const databaseEnvironment = readDatabaseEnvironment();

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = databaseEnvironment.DATABASE_URL;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
