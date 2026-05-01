import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

// ── GET /api/sites/[siteId]/settings ────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { siteId: string } },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const site = await prisma.site.findUnique({
      where: { id: params.siteId },
      select: {
        id:            true,
        name:          true,
        url:           true,
        walletAddress: true,
        network:       true,
        defaultPrice:  true,
        enableX402:    true,
        enableUniswap: true,
        verified:      true,
        active:        true,
        user: {
          select: { smartWalletAddress: true },
        },
      },
    });

    if (!site) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    // Attach network config so UI can display addresses without extra fetch
    const networkCfg = config.networks[site.network as keyof typeof config.networks] ?? null;

    return NextResponse.json({ site, networkConfig: networkCfg });
  } catch (err) {
    console.error('[GET /api/sites/[siteId]/settings]', err);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

// ── PATCH /api/sites/[siteId]/settings ──────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { siteId: string } },
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Validate site exists before update
    const existing = await prisma.site.findUnique({ where: { id: params.siteId } });
    if (!existing) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const body = await req.json() as {
      walletAddress?: string | null;
      network?:       string;
      defaultPrice?:  number;
      enableX402?:    boolean;
      enableUniswap?: boolean;
      name?:          string;
      active?:        boolean;
    };

    // Validate network if provided
    if (body.network && !config.networks[body.network as keyof typeof config.networks]) {
      return NextResponse.json(
        { error: `Invalid network "${body.network}". Valid: ${Object.keys(config.networks).join(', ')}` },
        { status: 400 },
      );
    }

    // Validate price if provided
    if (body.defaultPrice !== undefined && (body.defaultPrice < 0 || body.defaultPrice > 1000)) {
      return NextResponse.json(
        { error: 'defaultPrice must be between 0 and 1000 USDC' },
        { status: 400 },
      );
    }

    // Build update data — only include fields that were actually sent
    const data: Record<string, unknown> = {};
    if (body.walletAddress !== undefined) data.walletAddress = body.walletAddress;
    if (body.network       !== undefined) data.network       = body.network;
    if (body.defaultPrice  !== undefined) data.defaultPrice  = body.defaultPrice;
    if (body.enableX402    !== undefined) data.enableX402    = body.enableX402;
    if (body.enableUniswap !== undefined) data.enableUniswap = body.enableUniswap;
    if (body.name          !== undefined) data.name          = body.name;
    if (body.active        !== undefined) data.active        = body.active;

    const site = await prisma.site.update({
      where: { id: params.siteId },
      data,
    });

    return NextResponse.json({ site });
  } catch (err) {
    console.error('[PATCH /api/sites/[siteId]/settings]', err);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
