import { PrismaClient } from "@prisma/client";

// Singleton, damit Next.js im Dev-Modus (Hot Reload) nicht dutzende
// Verbindungen öffnet. Der Worker nutzt denselben Client.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
