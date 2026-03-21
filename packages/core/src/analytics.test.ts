import { describe, it, expect, beforeEach } from 'vitest';
import { AnalyticsCollector } from './analytics.js';

// ─── trackAccess ─────────────────────────────────────────────────────────────

describe('trackAccess', () => {
  let c: AnalyticsCollector;
  beforeEach(() => { c = new AnalyticsCollector(); });

  it('records a free allowed access', () => {
    c.trackAccess('OpenAI GPTBot', '/blog/post', true);
    const events = c.getAccessEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      botName: 'OpenAI GPTBot',
      path: '/blog/post',
      allowed: true,
    });
    expect(events[0].price).toBeUndefined();
  });

  it('records a paid access', () => {
    c.trackAccess('OpenAI GPTBot', '/blog/post', true, 100);
    const events = c.getAccessEvents();
    expect(events[0].price).toBe(100);
    expect(events[0].allowed).toBe(true);
  });

  it('records a blocked (denied) access', () => {
    c.trackAccess('OpenAI GPTBot', '/private', false);
    expect(c.getAccessEvents()[0].allowed).toBe(false);
  });

  it('sets a numeric timestamp close to now', () => {
    const before = Date.now();
    c.trackAccess('OpenAI GPTBot', '/page', true);
    const after = Date.now();
    const { timestamp } = c.getAccessEvents()[0];
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it('getAccessEvents returns a copy, not the internal array', () => {
    c.trackAccess('OpenAI GPTBot', '/page', true);
    const snap1 = c.getAccessEvents();
    c.trackAccess('Anthropic Claude-Web', '/page', true);
    const snap2 = c.getAccessEvents();
    expect(snap1).toHaveLength(1);
    expect(snap2).toHaveLength(2);
  });
});

// ─── trackPaymentRequired ─────────────────────────────────────────────────────

describe('trackPaymentRequired', () => {
  let c: AnalyticsCollector;
  beforeEach(() => { c = new AnalyticsCollector(); });

  it('records a payment-required event', () => {
    c.trackPaymentRequired('OpenAI GPTBot', '/research/paper', 500);
    const events = c.getPaymentEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      botName: 'OpenAI GPTBot',
      path: '/research/paper',
      price: 500,
    });
  });

  it('does not affect access event list', () => {
    c.trackPaymentRequired('OpenAI GPTBot', '/page', 100);
    expect(c.getAccessEvents()).toHaveLength(0);
  });

  it('getPaymentEvents returns a copy', () => {
    c.trackPaymentRequired('OpenAI GPTBot', '/page', 100);
    const snap = c.getPaymentEvents();
    c.trackPaymentRequired('Anthropic Claude-Web', '/page', 200);
    expect(snap).toHaveLength(1);
  });
});

// ─── getStats — counters ──────────────────────────────────────────────────────

describe('getStats — counters', () => {
  let c: AnalyticsCollector;
  beforeEach(() => { c = new AnalyticsCollector(); });

  it('starts with all zeros', () => {
    expect(c.getStats()).toMatchObject({
      totalRequests: 0,
      paidRequests: 0,
      revenue: 0,
      topBots: [],
      topPaths: [],
    });
  });

  it('counts totalRequests for every trackAccess call', () => {
    c.trackAccess('BotA', '/a', true);
    c.trackAccess('BotB', '/b', false);
    c.trackAccess('BotC', '/c', true, 100);
    expect(c.getStats().totalRequests).toBe(3);
  });

  it('counts paidRequests only when price > 0', () => {
    c.trackAccess('BotA', '/a', true, 100); // paid
    c.trackAccess('BotB', '/b', true, 0);   // price=0 → not paid
    c.trackAccess('BotC', '/c', true);      // no price → not paid
    c.trackAccess('BotD', '/d', false);     // blocked → not paid
    expect(c.getStats().paidRequests).toBe(1);
  });

  it('accumulates revenue only from price > 0 accesses', () => {
    c.trackAccess('BotA', '/a', true, 100);
    c.trackAccess('BotB', '/b', true, 250);
    c.trackAccess('BotC', '/c', true, 0);   // price=0: no revenue
    c.trackAccess('BotD', '/d', true);       // no price: no revenue
    expect(c.getStats().revenue).toBe(350);
  });

  it('trackPaymentRequired does not affect totalRequests or revenue', () => {
    c.trackPaymentRequired('BotA', '/page', 999);
    expect(c.getStats().totalRequests).toBe(0);
    expect(c.getStats().revenue).toBe(0);
  });

  it('getStats is non-mutating — repeated calls return the same values', () => {
    c.trackAccess('BotA', '/a', true, 100);
    const s1 = c.getStats();
    const s2 = c.getStats();
    expect(s1.totalRequests).toBe(s2.totalRequests);
    expect(s1.revenue).toBe(s2.revenue);
  });
});

// ─── getStats — topBots ───────────────────────────────────────────────────────

describe('getStats — topBots', () => {
  let c: AnalyticsCollector;
  beforeEach(() => { c = new AnalyticsCollector(); });

  it('lists each bot once', () => {
    c.trackAccess('BotA', '/a', true);
    c.trackAccess('BotB', '/b', true);
    const { topBots } = c.getStats();
    expect(topBots.map(b => b.name)).toEqual(expect.arrayContaining(['BotA', 'BotB']));
    expect(topBots).toHaveLength(2);
  });

  it('sorts by request count descending', () => {
    c.trackAccess('BotA', '/a', true);
    c.trackAccess('BotB', '/b', true);
    c.trackAccess('BotB', '/c', true);
    c.trackAccess('BotC', '/d', true);
    c.trackAccess('BotC', '/e', true);
    c.trackAccess('BotC', '/f', true);
    const names = c.getStats().topBots.map(b => b.name);
    expect(names).toEqual(['BotC', 'BotB', 'BotA']);
  });

  it('breaks request-count ties by revenue descending', () => {
    c.trackAccess('BotA', '/a', true, 50);   // 1 req, 50 rev
    c.trackAccess('BotB', '/b', true, 200);  // 1 req, 200 rev
    const names = c.getStats().topBots.map(b => b.name);
    expect(names[0]).toBe('BotB');
  });

  it('reports per-bot revenue correctly', () => {
    c.trackAccess('BotA', '/a', true, 100);
    c.trackAccess('BotA', '/b', true, 200);
    c.trackAccess('BotB', '/c', true, 50);
    const { topBots } = c.getStats();
    expect(topBots.find(b => b.name === 'BotA')?.revenue).toBe(300);
    expect(topBots.find(b => b.name === 'BotB')?.revenue).toBe(50);
  });

  it('limits topBots to 10 entries', () => {
    for (let i = 0; i < 15; i++) {
      c.trackAccess(`Bot${i}`, '/page', true);
    }
    expect(c.getStats().topBots).toHaveLength(10);
  });
});

// ─── getStats — topPaths ──────────────────────────────────────────────────────

describe('getStats — topPaths', () => {
  let c: AnalyticsCollector;
  beforeEach(() => { c = new AnalyticsCollector(); });

  it('lists each path once', () => {
    c.trackAccess('BotA', '/alpha', true);
    c.trackAccess('BotA', '/beta', true);
    const paths = c.getStats().topPaths.map(p => p.name);
    expect(paths).toEqual(expect.arrayContaining(['/alpha', '/beta']));
    expect(paths).toHaveLength(2);
  });

  it('sorts paths by request count descending', () => {
    c.trackAccess('BotA', '/popular', true);
    c.trackAccess('BotB', '/popular', true);
    c.trackAccess('BotC', '/popular', true);
    c.trackAccess('BotA', '/less-popular', true);
    const names = c.getStats().topPaths.map(p => p.name);
    expect(names[0]).toBe('/popular');
  });

  it('breaks path request-count ties by revenue descending', () => {
    c.trackAccess('BotA', '/cheap', true, 10);
    c.trackAccess('BotB', '/expensive', true, 500);
    const names = c.getStats().topPaths.map(p => p.name);
    expect(names[0]).toBe('/expensive');
  });

  it('accumulates revenue per path across multiple bots', () => {
    c.trackAccess('BotA', '/article', true, 100);
    c.trackAccess('BotB', '/article', true, 150);
    const entry = c.getStats().topPaths.find(p => p.name === '/article');
    expect(entry?.requests).toBe(2);
    expect(entry?.revenue).toBe(250);
  });

  it('limits topPaths to 10 entries', () => {
    for (let i = 0; i < 15; i++) {
      c.trackAccess('BotA', `/path-${i}`, true);
    }
    expect(c.getStats().topPaths).toHaveLength(10);
  });
});

// ─── combined scenario ────────────────────────────────────────────────────────

describe('combined scenario', () => {
  it('tracks a realistic mix of events and produces correct stats', () => {
    const c = new AnalyticsCollector();

    // GPTBot hits blog heavily
    c.trackAccess('OpenAI GPTBot', '/blog/post-1', true, 100);
    c.trackAccess('OpenAI GPTBot', '/blog/post-2', true, 100);
    c.trackAccess('OpenAI GPTBot', '/blog/post-3', true, 100);

    // Perplexity hits one article
    c.trackAccess('Perplexity PerplexityBot', '/blog/post-1', true, 150);

    // CCBot is blocked everywhere
    c.trackAccess('Common Crawl CCBot', '/blog/post-1', false);
    c.trackAccess('Common Crawl CCBot', '/blog/post-2', false);

    // One 402 issued (not an access event)
    c.trackPaymentRequired('Anthropic Claude-Web', '/research/paper', 500);

    const stats = c.getStats();

    expect(stats.totalRequests).toBe(6);
    expect(stats.paidRequests).toBe(4);
    expect(stats.revenue).toBe(450); // 3×100 + 1×150

    // GPTBot is the top bot by requests
    expect(stats.topBots[0].name).toBe('OpenAI GPTBot');
    expect(stats.topBots[0].requests).toBe(3);
    expect(stats.topBots[0].revenue).toBe(300);

    // /blog/post-1 is the top path (3 hits)
    expect(stats.topPaths[0].name).toBe('/blog/post-1');
    expect(stats.topPaths[0].requests).toBe(3);
    expect(stats.topPaths[0].revenue).toBe(250); // 100 + 150

    // Payment events don't bleed into access stats
    expect(c.getPaymentEvents()).toHaveLength(1);
    expect(c.getAccessEvents()).toHaveLength(6);
  });
});
