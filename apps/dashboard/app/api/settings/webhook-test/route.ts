import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { url } = await req.json() as { url?: string };
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  // In production: send a real HTTP POST to the webhook URL.
  // Demo: simulate a 600ms round-trip.
  await new Promise(r => setTimeout(r, 600));

  return NextResponse.json({
    success:    true,
    statusCode: 200,
    latencyMs:  Math.floor(Math.random() * 200 + 50),
    timestamp:  new Date().toISOString(),
  });
}
