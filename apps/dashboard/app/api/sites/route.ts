import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ── Shared type (used by frontend + siteId route) ─────────────────────────────

export interface SiteSummary {
  id:            string;
  name:          string;
  url:           string;
  status:        'active' | 'pending' | 'paused';
  verified:      boolean;
  installMethod: 'code' | 'dns' | null;
  createdAt:     string;   // ISO
  stats: {
    botBlocks:  number;
    botAllowed: number;
    revenue:    number;    // µUSDC
    paidBots:   number;
    blockRate:  number;    // 0-100
  };
}

type SiteRow = {
  id: string; name: string; url: string;
  verified: boolean; active: boolean;
  setupMethod: string; createdAt: Date;
  transactions: Array<{ amount: number }>;
};

/** Convert a raw Prisma Site row (with transactions) into the SiteSummary shape. */
function toSummary(site: SiteRow): SiteSummary {
  // Revenue: sum of verified transactions in USDC → convert to µUSDC for formatUsdcDollar
  const revenueUsdc  = site.transactions.reduce((s, tx) => s + tx.amount, 0);
  const revenueMicro = Math.round(revenueUsdc * 1_000_000);

  return {
    id:            site.id,
    name:          site.name,
    url:           site.url,
    status:        site.active ? (site.verified ? 'active' : 'pending') : 'paused',
    verified:      site.verified,
    installMethod: (site.setupMethod as 'code' | 'dns') ?? null,
    createdAt:     site.createdAt.toISOString(),
    stats: {
      botBlocks:  0,                           // populated by request-log middleware (future)
      botAllowed: site.transactions.length,    // paid = allowed through
      revenue:    revenueMicro,                // µUSDC
      paidBots:   site.transactions.length,
      blockRate:  0,
    },
  };
}

// ── GET /api/sites ────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Resolve Prisma user by email (Supabase UUID ≠ Prisma CUID)
    const dbUser = await prisma.user.findUnique({
      where:  { email: user.email! },
      select: { id: true },
    });
    if (!dbUser) return NextResponse.json({ sites: [] });

    // Fetch only this user's sites, including verified transaction totals
    const rows = await prisma.site.findMany({
      where:   { userId: dbUser.id },
      orderBy: { createdAt: 'desc' },
      include: {
        transactions: {
          where:  { verified: true },
          select: { amount: true },
        },
      },
    });

    const sites: SiteSummary[] = rows.map(toSummary);
    return NextResponse.json({ sites });
  } catch (err) {
    console.error('[GET /api/sites]', err);
    return NextResponse.json({ error: 'Failed to fetch sites' }, { status: 500 });
  }
}

// ── POST /api/sites ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { url?: string; method?: string };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rawUrl = body.url?.trim() ?? '';
  if (!rawUrl) return NextResponse.json({ error: 'url is required' }, { status: 400 });

  let hostname: string;
  try {
    hostname = new URL(rawUrl).hostname;
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    // Find or create a DB user row keyed on the Supabase user id
    const dbUser = await prisma.user.upsert({
      where:  { email: user.email! },
      update: { name: user.user_metadata?.name as string | undefined },
      create: { email: user.email!, name: user.user_metadata?.name as string | undefined },
    });

    const site = await prisma.site.create({
      data: {
        userId:      dbUser.id,
        name:        hostname,
        url:         rawUrl,
        setupMethod: body.method === 'dns' ? 'dns' : 'code',
        verified:    false,   // Verification happens after DNS check / middleware install
        active:      false,
      },
    });

    return NextResponse.json({ site: toSummary({ ...site, transactions: [] }), siteId: site.id }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/sites]', err);
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
  }
}
