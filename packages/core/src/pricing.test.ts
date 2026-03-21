import { describe, it, expect } from 'vitest';
import { PricingEngine } from './pricing.js';
import type { PricingRule } from './pricing.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function rule(overrides: Partial<PricingRule> & { id: string }): PricingRule {
  return {
    pricePerPage: 100,
    licenseType: 'summarization',
    ...overrides,
  };
}

// ─── basic matching ───────────────────────────────────────────────────────────

describe('basic matching', () => {
  it('returns null when there are no rules', () => {
    const engine = new PricingEngine([]);
    expect(engine.getPrice('/blog/post', 'OpenAI GPTBot')).toBeNull();
  });

  it('matches a global rule (no path, no bot)', () => {
    const engine = new PricingEngine([rule({ id: 'global', pricePerPage: 50 })]);
    const result = engine.getPrice('/anything', 'OpenAI GPTBot');
    expect(result?.pricePerPage).toBe(50);
    expect(result?.matchedRuleId).toBe('global');
  });

  it('returns null when no rule matches', () => {
    const engine = new PricingEngine([
      rule({ id: 'r1', path: '/blog/*', bot: 'OpenAI GPTBot' }),
    ]);
    expect(engine.getPrice('/shop/item', 'OpenAI GPTBot')).toBeNull();
  });

  it('includes licenseType in the result', () => {
    const engine = new PricingEngine([
      rule({ id: 'r1', licenseType: 'full_display' }),
    ]);
    expect(engine.getPrice('/page', 'AnyBot')?.licenseType).toBe('full_display');
  });

  it('allows pricePerPage of 0 (explicit free access)', () => {
    const engine = new PricingEngine([
      rule({ id: 'free', pricePerPage: 0 }),
    ]);
    const result = engine.getPrice('/page', 'OpenAI GPTBot');
    expect(result?.pricePerPage).toBe(0);
  });
});

// ─── exact path matching ──────────────────────────────────────────────────────

describe('exact path matching', () => {
  it('matches an exact path', () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/about' })]);
    expect(engine.getPrice('/about', 'OpenAI GPTBot')?.matchedRuleId).toBe('r1');
  });

  it('does not match a different exact path', () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/about' })]);
    expect(engine.getPrice('/contact', 'OpenAI GPTBot')).toBeNull();
  });

  it('does not match a sub-path of an exact rule', () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/blog' })]);
    expect(engine.getPrice('/blog/post', 'OpenAI GPTBot')).toBeNull();
  });

  it('treats trailing slashes as equivalent', () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/about/' })]);
    expect(engine.getPrice('/about', 'OpenAI GPTBot')?.matchedRuleId).toBe('r1');
    expect(engine.getPrice('/about/', 'OpenAI GPTBot')?.matchedRuleId).toBe('r1');
  });
});

// ─── single-segment wildcard "*" ─────────────────────────────────────────────

describe('single-segment wildcard (*)', () => {
  it('matches one path segment', () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/blog/*' })]);
    expect(engine.getPrice('/blog/my-post', 'GPTBot')?.matchedRuleId).toBe('r1');
  });

  it('does not match two segments deep', () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/blog/*' })]);
    expect(engine.getPrice('/blog/2024/my-post', 'GPTBot')).toBeNull();
  });

  it('does not match the parent path itself', () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/blog/*' })]);
    expect(engine.getPrice('/blog', 'GPTBot')).toBeNull();
  });

  it('matches wildcard in a middle segment', () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/docs/*/overview' })]);
    expect(engine.getPrice('/docs/v2/overview', 'GPTBot')?.matchedRuleId).toBe('r1');
    expect(engine.getPrice('/docs/v3/overview', 'GPTBot')?.matchedRuleId).toBe('r1');
  });

  it('does not match when a middle wildcard segment differs in count', () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/docs/*/overview' })]);
    expect(engine.getPrice('/docs/overview', 'GPTBot')).toBeNull();
  });
});

// ─── double-star wildcard "**" ────────────────────────────────────────────────

describe('double-star wildcard (**)', () => {
  it('matches any depth beneath a prefix', () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/api/**' })]);
    expect(engine.getPrice('/api/v1/users', 'GPTBot')?.matchedRuleId).toBe('r1');
    expect(engine.getPrice('/api/v2/posts/1', 'GPTBot')?.matchedRuleId).toBe('r1');
  });

  it('matches the prefix itself (zero trailing segments)', () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/api/**' })]);
    expect(engine.getPrice('/api', 'GPTBot')?.matchedRuleId).toBe('r1');
  });

  it('does not match a completely different prefix', () => {
    const engine = new PricingEngine([rule({ id: 'r1', path: '/api/**' })]);
    expect(engine.getPrice('/admin/users', 'GPTBot')).toBeNull();
  });
});

// ─── bot-only matching ────────────────────────────────────────────────────────

describe('bot-only matching (no path)', () => {
  it('matches any path for a specific bot', () => {
    const engine = new PricingEngine([
      rule({ id: 'r1', bot: 'OpenAI GPTBot', pricePerPage: 200 }),
    ]);
    expect(engine.getPrice('/anything', 'OpenAI GPTBot')?.pricePerPage).toBe(200);
    expect(engine.getPrice('/other', 'OpenAI GPTBot')?.pricePerPage).toBe(200);
  });

  it('does not match a different bot', () => {
    const engine = new PricingEngine([
      rule({ id: 'r1', bot: 'OpenAI GPTBot' }),
    ]);
    expect(engine.getPrice('/page', 'Anthropic Claude-Web')).toBeNull();
  });
});

// ─── specificity resolution ───────────────────────────────────────────────────

describe('specificity — most specific rule wins', () => {
  const rules: PricingRule[] = [
    rule({ id: 'global',   pricePerPage: 10 }),
    rule({ id: 'bot-only', pricePerPage: 20,  bot: 'OpenAI GPTBot' }),
    rule({ id: 'path-only', pricePerPage: 30, path: '/blog/*' }),
    rule({ id: 'exact',    pricePerPage: 40,  path: '/blog/post', bot: 'OpenAI GPTBot' }),
  ];

  it('path + bot beats all others', () => {
    const engine = new PricingEngine(rules);
    expect(engine.getPrice('/blog/post', 'OpenAI GPTBot')?.matchedRuleId).toBe('exact');
  });

  it('path-only beats bot-only and global (different bot)', () => {
    const engine = new PricingEngine(rules);
    expect(engine.getPrice('/blog/anything', 'Anthropic Claude-Web')?.matchedRuleId).toBe('path-only');
  });

  it('bot-only beats global (unmatched path)', () => {
    const engine = new PricingEngine(rules);
    expect(engine.getPrice('/shop/item', 'OpenAI GPTBot')?.matchedRuleId).toBe('bot-only');
  });

  it('global is used as final fallback', () => {
    const engine = new PricingEngine(rules);
    expect(engine.getPrice('/shop/item', 'Anthropic Claude-Web')?.matchedRuleId).toBe('global');
  });
});

describe('specificity — ties break by insertion order (first rule wins)', () => {
  it('first path+bot rule wins over second for same target', () => {
    const engine = new PricingEngine([
      rule({ id: 'first',  path: '/blog/*', bot: 'OpenAI GPTBot', pricePerPage: 100 }),
      rule({ id: 'second', path: '/blog/*', bot: 'OpenAI GPTBot', pricePerPage: 999 }),
    ]);
    expect(engine.getPrice('/blog/post', 'OpenAI GPTBot')?.matchedRuleId).toBe('first');
  });

  it('first global rule wins when two globals exist', () => {
    const engine = new PricingEngine([
      rule({ id: 'g1', pricePerPage: 5 }),
      rule({ id: 'g2', pricePerPage: 50 }),
    ]);
    expect(engine.getPrice('/page', 'AnyBot')?.matchedRuleId).toBe('g1');
  });
});

// ─── real-world multi-rule scenarios ─────────────────────────────────────────

describe('real-world scenarios', () => {
  it('premium AI content path + specific bot overrides global rate', () => {
    const engine = new PricingEngine([
      rule({ id: 'global',        pricePerPage: 100, licenseType: 'summarization' }),
      rule({ id: 'premium-gpt',   pricePerPage: 500, path: '/research/**', bot: 'OpenAI GPTBot', licenseType: 'full_display' }),
      rule({ id: 'premium-path',  pricePerPage: 300, path: '/research/**', licenseType: 'summarization' }),
    ]);

    const result = engine.getPrice('/research/paper-1', 'OpenAI GPTBot');
    expect(result?.matchedRuleId).toBe('premium-gpt');
    expect(result?.pricePerPage).toBe(500);
    expect(result?.licenseType).toBe('full_display');
  });

  it('blog wildcard applies to all crawlers but exact post overrides for one bot', () => {
    const engine = new PricingEngine([
      rule({ id: 'blog-all',       pricePerPage: 150, path: '/blog/*' }),
      rule({ id: 'blog-perplexity', pricePerPage: 250, path: '/blog/*', bot: 'Perplexity PerplexityBot' }),
    ]);

    expect(engine.getPrice('/blog/post-1', 'OpenAI GPTBot')?.matchedRuleId).toBe('blog-all');
    expect(engine.getPrice('/blog/post-1', 'Perplexity PerplexityBot')?.matchedRuleId).toBe('blog-perplexity');
  });

  it('returns null for a path/bot combo that no rule covers', () => {
    const engine = new PricingEngine([
      rule({ id: 'r1', path: '/blog/*', bot: 'OpenAI GPTBot' }),
    ]);
    // Different bot, same path — no match.
    expect(engine.getPrice('/blog/post', 'Anthropic Claude-Web')).toBeNull();
    // Same bot, different path — no match.
    expect(engine.getPrice('/about', 'OpenAI GPTBot')).toBeNull();
  });

  it('free-access rule (pricePerPage = 0) is a valid match, not treated as falsy', () => {
    const engine = new PricingEngine([
      rule({ id: 'free', path: '/public/**', pricePerPage: 0 }),
      rule({ id: 'paid', pricePerPage: 100 }),
    ]);
    const result = engine.getPrice('/public/data', 'AnyBot');
    expect(result?.matchedRuleId).toBe('free');
    expect(result?.pricePerPage).toBe(0);
  });
});
