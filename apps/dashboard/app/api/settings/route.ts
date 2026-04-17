import { NextRequest, NextResponse } from 'next/server';
import { SEED_SETTINGS } from '@/lib/settingsStore';

export const dynamic = 'force-dynamic';

// Settings live client-side (localStorage). These routes are stubs for
// production DB persistence — they echo what's sent.

export async function GET() {
  return NextResponse.json({ settings: SEED_SETTINGS });
}

export async function PUT(req: NextRequest) {
  const patch = await req.json();
  return NextResponse.json({ success: true, patch });
}
