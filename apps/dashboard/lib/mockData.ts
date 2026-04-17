/**
 * Deterministic mock data generator for ScraperKast dashboard demos.
 *
 * All numbers are seeded from a fixed base so charts look stable across
 * refreshes while still feeling live. Real Solana + analytics data will
 * replace this once the on-chain program is deployed.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type BotType = 'ai_training' | 'ai_inference' | 'search' | 'crawler';

export interface BotSummary {
  id:             string;
  name:           string;
  userAgent:      string;
  type:           BotType;
  totalRequests:  number;
  freeRequests:   number;
  paidRequests:   number;
  revenueEarned:  number; // µUSDC to owner
  successRate:    number; // 0-1
  lastSeen:       Date;
  firstSeen:      Date;
}

export interface RequestEvent {
  id:        string;
  timestamp: Date;
  botName:   string;
  botId:     string;
  path:      string;
  tier:      'free' | 'paid';
  amount:    number; // µUSDC (0 for free)
  status:    'allowed' | 'paid' | 'blocked';
}

export interface Transaction {
  id:            string;
  timestamp:     Date;
  botId:         string;
  botName:       string;
  domain:        string;
  basePrice:     number; // µUSDC to owner
  platformFee:   number; // µUSDC to platform
  totalPrice:    number;
  txHash:        string;
  status:        'confirmed' | 'pending' | 'failed';
  network:       'devnet' | 'mainnet';
  /** How the bot paid: direct Solana transfer or Dodo credit-card checkout. */
  paymentMethod: 'solana' | 'dodo';
  /** Dodo session ID — only present when paymentMethod === 'dodo'. */
  dodoSessionId?: string;
}

export interface HourlyPoint {
  hour:     string; // "14:00"
  requests: number;
  revenue:  number; // µUSDC
}

export interface DailyPoint {
  date:     string; // "Mon 10"
  revenue:  number; // µUSDC
  requests: number;
}

export interface BotShare {
  name:    string;
  value:   number; // request count
  fill:    string;
}

export interface DashboardStats {
  requestsToday:       number;
  requestsYesterday:   number;
  freeToday:           number;
  paidToday:           number;
  revenueToday:        number; // µUSDC
  revenueYesterday:    number;
  uniqueBots:          number;
  activeBotsLastHour:  number;
  avgPricePerRequest:  number; // µUSDC
  successRate:         number; // 0-1
  mostActiveBot:       string;
  revenueThisMonth:    number; // µUSDC
  ownerRevenue:        number; // 95%
  platformFees:        number; // 5%
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const BOTS: Pick<BotSummary, 'name' | 'userAgent' | 'type'>[] = [
  { name: 'GPTBot',        userAgent: 'Mozilla/5.0 AppleWebKit/537.36 GPTBot/1.0',                  type: 'ai_training'  },
  { name: 'Claude-Web',    userAgent: 'Mozilla/5.0 anthropic-ai/claude-web (+https://anthropic.com)', type: 'ai_inference' },
  { name: 'PerplexityBot', userAgent: 'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai)', type: 'ai_inference' },
  { name: 'Google-Extended',userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; Google-Extended)',   type: 'ai_training'  },
  { name: 'CCBot',         userAgent: 'CCBot/2.0 (https://commoncrawl.org/faq/)',                    type: 'crawler'      },
];

const BOT_COLORS = ['#028090', '#00A896', '#02C39A', '#6366f1', '#f59e0b'];

const PATHS = [
  '/blog/ai-content-monetization',
  '/blog/bot-detection-guide',
  '/docs/api-reference',
  '/docs/getting-started',
  '/pricing',
  '/about',
  '/blog/solana-payments',
  '/docs/pricing-rules',
  '/blog/openai-crawlers',
  '/research/language-models',
];

// ── Seeded pseudo-random ──────────────────────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function seededInt(seed: number, min: number, max: number): number {
  return Math.floor(seededRandom(seed) * (max - min + 1)) + min;
}

// ── Generators ────────────────────────────────────────────────────────────────

let _reqCounter = 0;
function nextId(): string { return `req-${++_reqCounter}`; }

/** Generate the last N hours of request data for the requests-over-time chart. */
export function generateHourlyData(hours = 24): HourlyPoint[] {
  const now = new Date();
  return Array.from({ length: hours }, (_, i) => {
    const h = new Date(now);
    h.setHours(h.getHours() - (hours - 1 - i), 0, 0, 0);
    const label = h.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const base  = i < 6 || i > 20 ? 8 : 25; // lower at night
    const reqs  = seededInt(i * 7 + 1, base, base + 40);
    const paid  = Math.floor(reqs * 0.3);
    const rev   = paid * seededInt(i * 3 + 2, 100, 800);
    return { hour: label, requests: reqs, revenue: rev };
  });
}

/** Generate the last N days of daily revenue for the revenue chart. */
export function generateDailyRevenue(days = 7): DailyPoint[] {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    const label = d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });
    const base  = 200_000;
    const reqs  = seededInt(i * 11 + 4, 80, 280);
    const rev   = seededInt(i * 13 + 5, base, base + 600_000);
    return { date: label, revenue: rev, requests: reqs };
  });
}

/** Generate bot distribution data for the pie chart. */
export function generateBotDistribution(): BotShare[] {
  return BOTS.map((b, i) => ({
    name:  b.name,
    value: seededInt(i * 17 + 6, 50, 400),
    fill:  BOT_COLORS[i] ?? '#94a3b8',
  }));
}

/** Generate the full bot summary table. */
export function generateBots(): BotSummary[] {
  const now = new Date();
  return BOTS.map((b, i) => {
    const total   = seededInt(i * 19 + 7, 200, 2000);
    const free    = Math.floor(total * seededRandom(i * 23 + 8) * 0.7 + total * 0.1);
    const paid    = total - free;
    const revenue = paid * seededInt(i * 29 + 9, 200, 1200);
    const lastMs  = seededInt(i * 31 + 10, 1, 60) * 60_000;
    const firstMs = seededInt(i * 37 + 11, 1, 30) * 24 * 60 * 60_000;
    return {
      id:            `bot-${i + 1}`,
      name:          b.name,
      userAgent:     b.userAgent,
      type:          b.type,
      totalRequests: total,
      freeRequests:  free,
      paidRequests:  paid,
      revenueEarned: revenue,
      successRate:   0.92 + seededRandom(i * 41 + 12) * 0.07,
      lastSeen:      new Date(now.getTime() - lastMs),
      firstSeen:     new Date(now.getTime() - firstMs),
    };
  });
}

/** Generate recent activity events. */
export function generateRecentActivity(count = 20): RequestEvent[] {
  const now    = Date.now();
  const events: RequestEvent[] = [];
  for (let i = 0; i < count; i++) {
    const botIdx  = seededInt(i * 43 + 13, 0, BOTS.length - 1);
    const bot     = BOTS[botIdx]!;
    const msAgo   = seededInt(i * 47 + 14, i * 15_000, i * 60_000 + 30_000);
    const isPaid  = seededRandom(i * 53 + 15) > 0.65;
    const amount  = isPaid ? seededInt(i * 59 + 16, 100, 1500) : 0;
    const statuses: RequestEvent['status'][] = ['allowed', 'paid', 'blocked'];
    const status  = isPaid ? 'paid' : seededRandom(i * 61 + 17) > 0.1 ? 'allowed' : 'blocked';

    events.push({
      id:        nextId(),
      timestamp: new Date(now - msAgo),
      botName:   bot.name,
      botId:     `${bot.name.toLowerCase()}-${seededInt(i * 67 + 18, 100, 999)}`,
      path:      PATHS[seededInt(i * 71 + 19, 0, PATHS.length - 1)]!,
      tier:      isPaid ? 'paid' : 'free',
      amount,
      status,
    });
  }
  return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/** Generate Solana transaction history. */
export function generateTransactions(count = 50): Transaction[] {
  const now    = Date.now();
  const txs: Transaction[] = [];
  const statuses: Transaction['status'][] = ['confirmed', 'confirmed', 'confirmed', 'pending', 'failed'];

  for (let i = 0; i < count; i++) {
    const botIdx     = seededInt(i * 73 + 20, 0, BOTS.length - 1);
    const bot        = BOTS[botIdx]!;
    const msAgo      = seededInt(i * 79 + 21, i * 120_000, i * 300_000 + 60_000);
    const base       = seededInt(i * 83 + 22, 200, 2000);
    const fee        = Math.ceil(base * 0.05);
    const statusIdx  = seededInt(i * 89 + 23, 0, statuses.length - 1);
    const chars      = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const hash       = Array.from({ length: 88 }, (_, k) =>
      chars[seededInt(i * 97 + k + 24, 0, chars.length - 1)]
    ).join('');

    const isDodo      = seededRandom(i * 103 + 26) > 0.7; // ~30% Dodo
    const dodoSession = isDodo
      ? `dodo_${Array.from({ length: 16 }, (_, k) => chars[seededInt(i * 107 + k, 0, chars.length - 1)]).join('')}`
      : undefined;

    txs.push({
      id:            `tx-${i + 1}`,
      timestamp:     new Date(now - msAgo),
      botId:         `${bot.name.toLowerCase()}-${seededInt(i * 101 + 25, 100, 999)}`,
      botName:       bot.name,
      domain:        'example.com',
      basePrice:     base,
      platformFee:   fee,
      totalPrice:    base + fee,
      txHash:        hash,
      status:        statuses[statusIdx]!,
      network:       'devnet',
      paymentMethod: isDodo ? 'dodo' : 'solana',
      ...(dodoSession ? { dodoSessionId: dodoSession } : {}),
    });
  }
  return txs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/** Compute top-level dashboard statistics. */
export function generateStats(): DashboardStats {
  const hourly   = generateHourlyData(24);
  const hourly2  = generateHourlyData(48); // yesterday = first 24
  const bots     = generateBots();
  const daily    = generateDailyRevenue(30);

  const today      = hourly.slice(-24);
  const yesterday  = hourly2.slice(0, 24);

  const reqToday   = today.reduce((s, h) => s + h.requests, 0);
  const reqYest    = yesterday.reduce((s, h) => s + h.requests, 0);
  const revToday   = today.reduce((s, h) => s + h.revenue, 0);
  const revYest    = yesterday.reduce((s, h) => s + h.revenue, 0);

  const paidFrac   = 0.28;
  const paidToday  = Math.floor(reqToday * paidFrac);
  const freeToday  = reqToday - paidToday;

  const monthRev   = daily.reduce((s, d) => s + d.revenue, 0);
  const mostActive = bots.reduce((a, b) => (b.totalRequests > a.totalRequests ? b : a), bots[0]!);
  const totalPaid  = bots.reduce((s, b) => s + b.paidRequests, 0);
  const avgPrice   = totalPaid > 0
    ? bots.reduce((s, b) => s + b.revenueEarned, 0) / totalPaid
    : 0;

  return {
    requestsToday:       reqToday,
    requestsYesterday:   reqYest,
    freeToday,
    paidToday,
    revenueToday:        revToday,
    revenueYesterday:    revYest,
    uniqueBots:          bots.length,
    activeBotsLastHour:  3,
    avgPricePerRequest:  Math.round(avgPrice),
    successRate:         0.947,
    mostActiveBot:       mostActive.name,
    revenueThisMonth:    monthRev,
    ownerRevenue:        Math.floor(monthRev * 0.95),
    platformFees:        Math.ceil(monthRev * 0.05),
  };
}
