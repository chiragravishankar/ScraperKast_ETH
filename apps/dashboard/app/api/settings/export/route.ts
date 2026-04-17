import { NextResponse } from 'next/server';
import { SEED_SETTINGS } from '@/lib/settingsStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Production: read from DB. Demo: export seed defaults.
  return NextResponse.json({ version: 1, settings: SEED_SETTINGS, exportedAt: new Date().toISOString() });
}
