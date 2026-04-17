import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.json() as { ids: string[]; action: string; payload?: unknown };
  if (!body.ids?.length) return NextResponse.json({ error: 'ids required' }, { status: 400 });
  // In production: batch DB update. Demo: echo.
  return NextResponse.json({ success: true, affected: body.ids.length, action: body.action });
}
