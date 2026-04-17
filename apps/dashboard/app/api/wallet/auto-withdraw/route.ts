import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const settings = await req.json();
  // In production: persist to database keyed by site owner session.
  return NextResponse.json({ success: true, settings });
}
