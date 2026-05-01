import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import type { SiteSummary } from '../route';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActivityItem {
  id:      string;
  timeAgo: string;
  bot:     string;
  status:  'blocked' | 'paid' | 'allowed';
  path:    string;
  amount:  number;  // µUSDC (0 when not paid)
}

export interface TopBot {
  name:     string;
  type:     string;
  requests: number;
  paid:     number;
  blocked:  number;
  revenue:  number; // µUSDC
}

export interface SiteDetail {
  summary:         SiteSummary;
  activity:        ActivityItem[];
  topBots:         TopBot[];
  recommendations: { id: string; title: string; body: string; cta: string; revenue: number }[];
  setupChecklist:  { label: string; done: boolean; action?: string }[];
  recentTxns:      {
    time: string; bot: string; amount: number; path: string;
    txHash: string; network: 'devnet' | 'mainnet';
  }[];
}

// ── Build mock analytics (replaces real events table when no data yet) ─────────

function mockDetail(summary: SiteSummary): SiteDetail {
  const verified = summary.verified;

  const activity: ActivityItem[] = verified
    ? [
        { id: '1', timeAgo: 'just now', bot: 'GPTBot',    status: 'blocked', path: '/blog/ai-2026',  amount: 0      },
        { id: '2', timeAgo: '12s ago',  bot: 'Firecrawl', status: 'paid',    path: '/articles/llms', amount: 50_000 },
        { id: '3', timeAgo: '45s ago',  bot: 'ClaudeBot', status: 'blocked', path: '/blog/agents',   amount: 0      },
        { id: '4', timeAgo: '2m ago',   bot: 'Scrapy',    status: 'blocked', path: '/sitemap.xml',   amount: 0      },
        { id: '5', timeAgo: '3m ago',   bot: 'ChatGPT',   status: 'paid',    path: '/blog/tariffs',  amount: 50_000 },
        { id: '6', timeAgo: '5m ago',   bot: 'Diffbot',   status: 'allowed', path: '/about',         amount: 0      },
      ]
    : [];

  const topBots: TopBot[] = verified
    ? [
        { name: 'GPTBot',    type: 'AI',          requests: 245, paid: 12, blocked: 233, revenue: 600_000   },
        { name: 'Firecrawl', type: 'Commercial',  requests: 187, paid: 45, blocked: 142, revenue: 2_250_000 },
        { name: 'ClaudeBot', type: 'AI',          requests: 156, paid: 0,  blocked: 156, revenue: 0         },
        { name: 'Scrapy',    type: 'Open Source', requests: 120, paid: 0,  blocked: 120, revenue: 0         },
        { name: 'Diffbot',   type: 'Commercial',  requests: 98,  paid: 23, blocked: 75,  revenue: 1_150_000 },
      ]
    : [];

  const recommendations = verified
    ? [
        {
          id:      'rec_claudebot',
          title:   'Earn $124/mo more from ClaudeBot',
          body:    '156 ClaudeBot requests were blocked last month. Allow them at $0.001/request and turn that traffic into revenue.',
          cta:     'Enable ClaudeBot pricing →',
          revenue: 124_000_000,
        },
        {
          id:      'rec_gptbot',
          title:   'GPTBot reads your articles daily',
          body:    "245 GPTBot requests hit your site. OpenAI doesn't pay without a licensing agreement — block or charge with ScraperKast.",
          cta:     'Configure GPTBot rule →',
          revenue: 0,
        },
      ]
    : [
        {
          id:      'rec_install',
          title:   'Finish setup to start earning',
          body:    'Install the ScraperKast middleware in 2 minutes and start protecting this site immediately.',
          cta:     'View install guide →',
          revenue: 0,
        },
      ];

  const setupChecklist = [
    { label: 'Site added',              done: true                    },
    { label: 'Middleware installed',    done: verified,  action: verified ? undefined : 'Install guide →' },
    { label: 'Wallet address configured', done: true                  },
    { label: 'Pricing rules set',       done: verified,  action: verified ? undefined : 'Configure →'    },
    { label: 'First bot blocked',       done: summary.stats.botBlocks > 0 },
  ];

  const recentTxns = verified
    ? [
        { time: 'Today, 14:23', bot: 'Firecrawl', amount: 50_000, path: '/articles/llms',  txHash: '5xKj2...mN9p', network: 'devnet' as const },
        { time: 'Today, 11:07', bot: 'ChatGPT',   amount: 50_000, path: '/blog/tariffs',   txHash: '3aLm8...vQ2r', network: 'devnet' as const },
        { time: 'Yesterday',    bot: 'Diffbot',   amount: 50_000, path: '/blog/ai-agents', txHash: '7pRt4...wX1s', network: 'devnet' as const },
      ]
    : [];

  return { summary, activity, topBots, recommendations, setupChecklist, recentTxns };
}

// ── GET /api/sites/[siteId] ───────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { siteId: string } },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const row = await prisma.site.findUnique({ where: { id: params.siteId } });
    if (!row) return NextResponse.json({ error: 'Site not found' }, { status: 404 });

    const summary: SiteSummary = {
      id:            row.id,
      name:          row.name,
      url:           row.url,
      status:        row.active ? (row.verified ? 'active' : 'pending') : 'paused',
      verified:      row.verified,
      installMethod: (row.setupMethod as 'code' | 'dns') ?? null,
      createdAt:     row.createdAt.toISOString(),
      // Real analytics TBD — zeros for now
      stats: { botBlocks: 0, botAllowed: 0, revenue: 0, paidBots: 0, blockRate: 0 },
    };

    return NextResponse.json(mockDetail(summary));
  } catch (err) {
    console.error('[GET /api/sites/[siteId]]', err);
    return NextResponse.json({ error: 'Failed to fetch site' }, { status: 500 });
  }
}

// ── DELETE /api/sites/[siteId] ────────────────────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: { siteId: string } },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await prisma.site.delete({ where: { id: params.siteId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/sites/[siteId]]', err);
    return NextResponse.json({ error: 'Failed to delete site' }, { status: 500 });
  }
}

// ── PATCH /api/sites/[siteId] — update name / verified / active ───────────────

export async function PATCH(
  req: Request,
  { params }: { params: { siteId: string } },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json() as Partial<{ name: string; verified: boolean; active: boolean; defaultPrice: number }>;
    const site  = await prisma.site.update({
      where: { id: params.siteId },
      data:  body,
    });
    return NextResponse.json({ site });
  } catch (err) {
    console.error('[PATCH /api/sites/[siteId]]', err);
    return NextResponse.json({ error: 'Failed to update site' }, { status: 500 });
  }
}
