import { NextResponse } from 'next/server';
import { generateStats, generateRecentActivity } from '@/lib/mockData';

export const dynamic = 'force-dynamic';

// Lightweight polling endpoint — returns just the numbers that change frequently.
export async function GET() {
  const stats  = generateStats();
  const recent = generateRecentActivity(5);

  return NextResponse.json({
    requestsToday:      stats.requestsToday,
    revenueToday:       stats.revenueToday,
    activeBotsLastHour: stats.activeBotsLastHour,
    recent,
    updatedAt:          new Date().toISOString(),
  });
}
