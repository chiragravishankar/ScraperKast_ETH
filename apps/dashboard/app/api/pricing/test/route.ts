import { NextRequest, NextResponse } from 'next/server';
import type { PricingRule } from '@/lib/pricingStore';
import { matchesPath, matchesBot } from '@/lib/pricingStore';

export const dynamic = 'force-dynamic';

const GROUP_MAP: Record<string, string[]> = {
  'verified-ai':    ['gptbot','claudeweb','perplexitybot','googleextended','amazonbot'],
  'search-engines': ['googlebot','bingbot','duckduckbot','applebot'],
  'data-crawlers':  ['ccbot','semrushbot','ahrefsbot'],
  'social-media':   ['facebookbot','twitterbot'],
  'suspicious':     ['scraperapi','bytespider','unknownbot'],
};

export async function POST(req: NextRequest) {
  const { path, botId, rules } = await req.json() as {
    path: string;
    botId: string;
    rules: PricingRule[];
  };

  const sorted = [...rules]
    .filter(r => r.enabled)
    .sort((a, b) => a.priority - b.priority);

  const considered: { rule: PricingRule; matchedPath: boolean; matchedBot: boolean }[] = [];
  let matched: PricingRule | null = null;

  for (const rule of sorted) {
    const mp = matchesPath(rule, path);
    const mb = matchesBot(rule, botId, GROUP_MAP);
    considered.push({ rule, matchedPath: mp, matchedBot: mb });
    if (mp && mb && !matched) matched = rule;
  }

  return NextResponse.json({ matched, considered });
}
