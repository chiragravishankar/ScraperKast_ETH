import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

// ── Resolve database URL ──────────────────────────────────────────────────────
//
// DATABASE_URL is set in .env.local for dev and as an env var in production.
// Format: "file:/absolute/path/to/prisma/dev.db"

function getDbUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Add DATABASE_URL="file:/absolute/path/to/prisma/dev.db" to .env.local',
    );
  }
  return url;
}

// ── Singleton (prevents connection exhaustion during Next.js HMR) ─────────────

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makePrismaClient(): PrismaClient {
  // In Prisma 7, PrismaLibSql takes a config object (not an existing client)
  const adapter = new PrismaLibSql({ url: getDbUrl() });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any);
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (globalForPrisma.prisma = makePrismaClient());
