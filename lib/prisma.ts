// lib/prisma.ts
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function mustGet(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    const connectionString = mustGet("DATABASE_URL");

    const pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });

    const adapter = new PrismaPg(pool);

    return new PrismaClient({
      adapter,
      log:
        process.env.NODE_ENV === "development"
          ? ["error", "warn"]
          : ["error"],
    });
  })();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;