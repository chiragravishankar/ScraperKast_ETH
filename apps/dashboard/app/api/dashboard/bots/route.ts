import { NextResponse } from 'next/server';
import { generateBots, generateRecentActivity } from '@/lib/mockData';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tier   = searchParams.get('tier');   // 'free' | 'paid' | null
  const search = searchParams.get('search') ?? '';

  let bots = generateBots();

  if (search) {
    bots = bots.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));
  }
  if (tier === 'paid') {
    bots = bots.filter(b => b.paidRequests > 0);
  } else if (tier === 'free') {
    bots = bots.filter(b => b.freeRequests > 0);
  }

  const recent = generateRecentActivity(20);

  return NextResponse.json({ bots, recent });
}
