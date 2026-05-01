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

/** Convert a raw Prisma Site row into the SiteSummary shape the UI expects. */
function toSummary(site: {
  id: string; name: string; url: string;
  verified: boolean; active: boolean;
  setupMethod: string; createdAt: Date;
}): SiteSummary {
  return {
    id:            site.id,
    name:          site.name,
    url:           site.url,
    status:        site.active ? (site.verified ? 'active' : 'pending') : 'paused',
    verified:      site.verified,
    installMethod: (site.setupMethod as 'code' | 'dns') ?? null,
    createdAt:     site.createdAt.toISOString(),
    // Real analytics will come from an events table; mock zeros for new sites
    stats: { botBlocks: 0, botAllowed: 0, revenue: 0, paidBots: 0, blockRate: 0 },
  };
}

// ── GET /api/sites ────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await prisma.site.findMany({
      orderBy: { createdAt: 'desc' },
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

    return NextResponse.json({ site: toSummary(site), siteId: site.id }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/sites]', err);
    return NextResponse.json({ error: 'Failed to create site' }, { status: 500 });
  }
}
