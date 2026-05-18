import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { createPrismaAdapter } from "@/lib/prisma-adapter";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createPrismaAdapter(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
