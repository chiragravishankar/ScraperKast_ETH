import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_GROUPS } from '@/lib/botStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ groups: DEFAULT_GROUPS });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  return NextResponse.json({ success: true, group: body });
}
