/**
 * Seed script — run with:
 *   DATABASE_URL="file:$(pwd)/prisma/dev.db" npx tsx prisma/seed.ts
 */

import { PrismaLibSql } from '@prisma/adapter-libsql';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL! });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma  = new PrismaClient({ adapter } as any);

async function main() {
  // Demo user
  const user = await prisma.user.upsert({
    where:  { email: 'demo@scraperkast.com' },
    update: {},
    create: { email: 'demo@scraperkast.com', name: 'Demo User' },
  });
  console.log('User:', user.id);

  // Demo sites
  const seeds = [
    { id: 'site_techblog',   name: 'techblog.io',       url: 'https://techblog.io',       setupMethod: 'code', verified: true,  active: true  },
    { id: 'site_airesearch', name: 'airesearch.dev',    url: 'https://airesearch.dev',    setupMethod: 'dns',  verified: true,  active: true  },
    { id: 'site_newsletter', name: 'mynewsletter.com',  url: 'https://mynewsletter.com',  setupMethod: 'code', verified: false, active: false },
  ];

  for (const seed of seeds) {
    const site = await prisma.site.upsert({
      where:  { id: seed.id },
      update: {},
      create: { ...seed, userId: user.id, defaultPrice: 0.001 },
    });
    console.log('Site:', site.id, site.name);
  }

  console.log('✅ Seed complete');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
