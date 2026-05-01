/**
 * PATCH /api/wallet/settings
 *
 * Updates the authenticated user's wallet settings.
 * Currently supports: withdrawalAddress
 *
 * Body: { withdrawalAddress?: string }
 * Response: { withdrawalAddress }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function isValidEthAddress(addr: string) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export async function PATCH(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    const body = await req.json() as { withdrawalAddress?: unknown };
    const rawAddr = body.withdrawalAddress;

    if (rawAddr === undefined) {
      return NextResponse.json({ error: 'No settings provided' }, { status: 400 });
    }

    // Allow clearing the address by sending null or empty string
    const addr = rawAddr === null || rawAddr === '' ? null : String(rawAddr).trim();

    if (addr !== null && !isValidEthAddress(addr)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address — must be 0x followed by 40 hex characters' },
        { status: 422 },
      );
    }

    // ── Upsert user row ───────────────────────────────────────────────────────
    // User row may not exist yet for brand-new Supabase signups
    const updated = await prisma.user.upsert({
      where:  { id: user.id },
      create: {
        id:                user.id,
        email:             user.email ?? '',
        withdrawalAddress: addr,
      },
      update: {
        withdrawalAddress: addr,
      },
      select: { withdrawalAddress: true },
    });

    return NextResponse.json({ withdrawalAddress: updated.withdrawalAddress });
  } catch (err) {
    console.error('[PATCH /api/wallet/settings]', err);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

// ── GET — fetch current settings ─────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where:  { id: user.id },
      select: { withdrawalAddress: true },
    });

    return NextResponse.json({
      withdrawalAddress: dbUser?.withdrawalAddress ?? null,
    });
  } catch (err) {
    console.error('[GET /api/wallet/settings]', err);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}
