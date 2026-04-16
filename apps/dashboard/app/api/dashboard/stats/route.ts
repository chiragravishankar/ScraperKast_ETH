import { NextResponse } from 'next/server';
import { generateStats, generateHourlyData, generateDailyRevenue, generateBotDistribution } from '@/lib/mockData';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stats   = generateStats();
  const hourly  = generateHourlyData(24);
  const daily   = generateDailyRevenue(7);
  const botDist = generateBotDistribution();

  return NextResponse.json({ stats, hourly, daily, botDist });
}
