import { NextRequest, NextResponse } from 'next/server';
import { ALL_BOTS } from '@/lib/botStore';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const bot = ALL_BOTS.find(b => b.id === params.id);
  if (!bot) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ bot });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const bot = ALL_BOTS.find(b => b.id === params.id);
  if (!bot) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const patch = await req.json();
  // In production: persist to DB. Demo: just echo.
  return NextResponse.json({ success: true, id: params.id, patch });
}
