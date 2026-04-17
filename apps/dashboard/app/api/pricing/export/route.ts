import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// The actual export is generated client-side from localStorage.
// This route is a placeholder for server-side export in production.
export async function GET() {
  return NextResponse.json({ message: 'Use client-side exportRules() from pricingStore.' });
}
