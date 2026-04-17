import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Rules live client-side (localStorage). These routes are stubs for
// production persistence (DB). They echo back what's sent.

export async function GET() {
  return NextResponse.json({ rules: [] }); // client loads from localStorage
}

export async function POST(req: NextRequest) {
  const rule = await req.json();
  return NextResponse.json({ success: true, rule });
}
