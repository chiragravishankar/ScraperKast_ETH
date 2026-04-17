import { NextRequest, NextResponse } from 'next/server';
import { ALL_BOTS } from '@/lib/botStore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q      = (searchParams.get('q') ?? '').toLowerCase();
  const status = searchParams.get('status') ?? 'all';
  const tier   = searchParams.get('tier')   ?? 'all';

  let bots = ALL_BOTS;
  if (q)             bots = bots.filter(b => b.name.toLowerCase().includes(q) || b.company.toLowerCase().includes(q));
  if (status !== 'all') {
    // Configs live client-side; server just returns the bot catalog.
    // Status filtering is done in the client store.
  }
  void tier; // client-side filter

  return NextResponse.json({ bots });
}
