import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ── GET /api/sites/[siteId]/bot-rules ────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { siteId: string } },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rules = await prisma.botRule.findMany({ where: { siteId: params.siteId } });
    return NextResponse.json({ rules });
  } catch (err) {
    console.error('[GET /api/sites/[siteId]/bot-rules]', err);
    return NextResponse.json({ error: 'Failed to fetch bot rules' }, { status: 500 });
  }
}

// ── POST /api/sites/[siteId]/bot-rules ───────────────────────────────────────
// Body: { rules: Record<botId, { action, enabled, price }> }

export async function POST(
  req: NextRequest,
  { params }: { params: { siteId: string } },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { rules?: Record<string, { action: string; enabled: boolean; price: number }> };
  try {
    body = await req.json() as typeof body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const rules = body.rules ?? {};

  try {
    // Upsert each rule using Prisma's upsert
    const ops = Object.entries(rules).map(([botId, cfg]) =>
      prisma.botRule.upsert({
        where:  { siteId_botId: { siteId: params.siteId, botId } },
        create: { siteId: params.siteId, botId, action: cfg.action, enabled: cfg.enabled, price: cfg.price },
        update: { action: cfg.action, enabled: cfg.enabled, price: cfg.price },
      }),
    );

    await prisma.$transaction(ops);
    return NextResponse.json({ saved: Object.keys(rules).length });
  } catch (err) {
    console.error('[POST /api/sites/[siteId]/bot-rules]', err);
    return NextResponse.json({ error: 'Failed to save bot rules' }, { status: 500 });
  }
}
