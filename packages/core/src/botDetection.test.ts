import { describe, it, expect } from 'vitest';
import { detectBot } from './botDetection.js';
import type { BotDetectionResult, BotType } from './botDetection.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function expectBot(
  result: BotDetectionResult,
  expectedName: string,
  expectedType: BotType,
  expectedConfidence = 1.0,
) {
  expect(result.isBot).toBe(true);
  expect(result.botName).toBe(expectedName);
  expect(result.type).toBe(expectedType);
  expect(result.confidence).toBe(expectedConfidence);
}

function expectHuman(result: BotDetectionResult) {
  expect(result.isBot).toBe(false);
  expect(result.botName).toBeNull();
  expect(result.confidence).toBe(0);
  expect(result.type).toBeNull();
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

describe('OpenAI bots', () => {
  it('detects GPTBot (ai_training) with full UA', () => {
    expectBot(
      detectBot('Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.0; +https://openai.com/gptbot)'),
      'OpenAI GPTBot',
      'ai_training',
    );
  });

  it('detects GPTBot (bare token)', () => {
    expectBot(detectBot('GPTBot/1.0'), 'OpenAI GPTBot', 'ai_training');
  });

  it('detects GPTBot case-insensitively', () => {
    expectBot(detectBot('gptbot/1.0'), 'OpenAI GPTBot', 'ai_training');
    expectBot(detectBot('GPTBOT'), 'OpenAI GPTBot', 'ai_training');
  });

  it('detects ChatGPT-User (ai_inference) with full UA', () => {
    expectBot(
      detectBot('Mozilla/5.0 AppleWebKit/537.36 (compatible; ChatGPT-User/1.0; +https://openai.com/bot)'),
      'OpenAI ChatGPT-User',
      'ai_inference',
    );
  });

  it('detects ChatGPT-User (bare token)', () => {
    expectBot(detectBot('ChatGPT-User/1.0'), 'OpenAI ChatGPT-User', 'ai_inference');
  });

  it('detects ChatGPT-User case-insensitively', () => {
    expectBot(detectBot('chatgpt-user/1.0'), 'OpenAI ChatGPT-User', 'ai_inference');
  });
});

// ─── Anthropic ───────────────────────────────────────────────────────────────

describe('Anthropic bots', () => {
  it('detects Claude-Web (ai_inference)', () => {
    expectBot(
      detectBot('Mozilla/5.0 (compatible; Claude-Web/1.0; +https://www.anthropic.com/claude-web)'),
      'Anthropic Claude-Web',
      'ai_inference',
    );
  });

  it('detects Claude-Web case-insensitively', () => {
    expectBot(detectBot('claude-web/1.0'), 'Anthropic Claude-Web', 'ai_inference');
  });

  it('detects anthropic-ai (ai_training)', () => {
    expectBot(detectBot('anthropic-ai/1.0'), 'Anthropic anthropic-ai', 'ai_training');
  });

  it('detects anthropic-ai case-insensitively', () => {
    expectBot(detectBot('ANTHROPIC-AI/1.0'), 'Anthropic anthropic-ai', 'ai_training');
  });

  it('detects claude-bot (ai_inference)', () => {
    expectBot(detectBot('claude-bot/1.0'), 'Anthropic claude-bot', 'ai_inference');
  });

  it('detects claude-bot with full UA', () => {
    expectBot(
      detectBot('Mozilla/5.0 (compatible; claude-bot/1.0; +https://www.anthropic.com)'),
      'Anthropic claude-bot',
      'ai_inference',
    );
  });

  it('detects claude-bot case-insensitively', () => {
    expectBot(detectBot('Claude-Bot/1.0'), 'Anthropic claude-bot', 'ai_inference');
  });
});

// ─── Google ───────────────────────────────────────────────────────────────────

describe('Google bots', () => {
  it('detects Googlebot (search) with full UA', () => {
    expectBot(
      detectBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
      'Google Googlebot',
      'search',
    );
  });

  it('detects Googlebot (bare token)', () => {
    expectBot(detectBot('Googlebot/2.1'), 'Google Googlebot', 'search');
  });

  it('detects Googlebot case-insensitively', () => {
    expectBot(detectBot('googlebot/2.1'), 'Google Googlebot', 'search');
  });

  it('detects Google-Extended (ai_training) with full UA', () => {
    expectBot(
      detectBot('Mozilla/5.0 (compatible; Google-Extended/1.0)'),
      'Google Google-Extended',
      'ai_training',
    );
  });

  it('detects Google-Extended case-insensitively', () => {
    expectBot(detectBot('google-extended'), 'Google Google-Extended', 'ai_training');
  });

  it('Google-Extended takes priority over Googlebot on a composite UA', () => {
    // The more-specific definition is listed first in BOT_DEFINITIONS.
    expectBot(
      detectBot('Google-Extended Googlebot/2.1'),
      'Google Google-Extended',
      'ai_training',
    );
  });
});

// ─── Bing ─────────────────────────────────────────────────────────────────────

describe('Bing bots', () => {
  it('detects bingbot (search) with full UA', () => {
    expectBot(
      detectBot('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'),
      'Microsoft bingbot',
      'search',
    );
  });

  it('detects bingbot (bare token)', () => {
    expectBot(detectBot('bingbot/2.0'), 'Microsoft bingbot', 'search');
  });

  it('detects bingbot case-insensitively', () => {
    expectBot(detectBot('BingBot/2.0'), 'Microsoft bingbot', 'search');
  });
});

// ─── Perplexity ───────────────────────────────────────────────────────────────

describe('Perplexity bots', () => {
  it('detects PerplexityBot (ai_inference)', () => {
    expectBot(
      detectBot('Mozilla/5.0 AppleWebKit/537.36 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'),
      'Perplexity PerplexityBot',
      'ai_inference',
    );
  });

  it('detects PerplexityBot (bare token)', () => {
    expectBot(detectBot('PerplexityBot/1.0'), 'Perplexity PerplexityBot', 'ai_inference');
  });

  it('detects PerplexityBot case-insensitively', () => {
    expectBot(detectBot('perplexitybot/1.0'), 'Perplexity PerplexityBot', 'ai_inference');
  });

  it('detects PerplexitySearchBot (ai_inference)', () => {
    expectBot(detectBot('PerplexitySearchBot/1.0'), 'Perplexity PerplexitySearchBot', 'ai_inference');
  });

  it('detects PerplexitySearchBot with full UA', () => {
    expectBot(
      detectBot('Mozilla/5.0 (compatible; PerplexitySearchBot/1.0; +https://perplexity.ai)'),
      'Perplexity PerplexitySearchBot',
      'ai_inference',
    );
  });

  it('PerplexitySearchBot takes priority over PerplexityBot on a composite UA', () => {
    expectBot(
      detectBot('PerplexitySearchBot/1.0 (PerplexityBot)'),
      'Perplexity PerplexitySearchBot',
      'ai_inference',
    );
  });
});

// ─── You.com ──────────────────────────────────────────────────────────────────

describe('You.com bots', () => {
  it('detects YouBot (ai_inference)', () => {
    expectBot(detectBot('YouBot/1.0'), 'You.com YouBot', 'ai_inference');
  });

  it('detects YouBot with full UA', () => {
    expectBot(
      detectBot('Mozilla/5.0 (compatible; YouBot; +https://you.com/youbot)'),
      'You.com YouBot',
      'ai_inference',
    );
  });

  it('detects YouBot case-insensitively', () => {
    expectBot(detectBot('youbot/1.0'), 'You.com YouBot', 'ai_inference');
  });
});

// ─── Cohere ───────────────────────────────────────────────────────────────────

describe('Cohere bots', () => {
  it('detects cohere-ai (ai_training)', () => {
    expectBot(detectBot('cohere-ai/1.0'), 'Cohere cohere-ai', 'ai_training');
  });

  it('detects cohere-ai with full UA', () => {
    expectBot(
      detectBot('Mozilla/5.0 (compatible; cohere-ai/1.0; +https://cohere.com)'),
      'Cohere cohere-ai',
      'ai_training',
    );
  });

  it('detects cohere-ai case-insensitively', () => {
    expectBot(detectBot('Cohere-AI/1.0'), 'Cohere cohere-ai', 'ai_training');
  });
});

// ─── Common Crawl ─────────────────────────────────────────────────────────────

describe('Common Crawl bots', () => {
  it('detects CCBot (ai_training) with full UA', () => {
    expectBot(
      detectBot('CCBot/2.0 (https://commoncrawl.org/faq/)'),
      'Common Crawl CCBot',
      'ai_training',
    );
  });

  it('detects CCBot (bare token)', () => {
    expectBot(detectBot('CCBot/2.0'), 'Common Crawl CCBot', 'ai_training');
  });

  it('detects CCBot case-insensitively', () => {
    expectBot(detectBot('ccbot/2.0'), 'Common Crawl CCBot', 'ai_training');
  });
});

// ─── SEO crawlers ─────────────────────────────────────────────────────────────

describe('SEO crawlers', () => {
  it('detects SemrushBot (crawler)', () => {
    expectBot(
      detectBot('Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)'),
      'Semrush SemrushBot',
      'crawler',
    );
  });

  it('detects SemrushBot (bare token)', () => {
    expectBot(detectBot('SemrushBot/7'), 'Semrush SemrushBot', 'crawler');
  });

  it('detects SemrushBot case-insensitively', () => {
    expectBot(detectBot('semrushbot/7'), 'Semrush SemrushBot', 'crawler');
  });

  it('detects AhrefsBot (crawler) with full UA', () => {
    expectBot(
      detectBot('Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'),
      'Ahrefs AhrefsBot',
      'crawler',
    );
  });

  it('detects AhrefsBot (bare token)', () => {
    expectBot(detectBot('AhrefsBot/7.0'), 'Ahrefs AhrefsBot', 'crawler');
  });

  it('detects AhrefsBot case-insensitively', () => {
    expectBot(detectBot('ahrefsbot/7.0'), 'Ahrefs AhrefsBot', 'crawler');
  });

  it('detects DotBot (crawler) with full UA', () => {
    expectBot(
      detectBot('Mozilla/5.0 (compatible; DotBot/1.2; +https://opensiteexplorer.org/dotbot)'),
      'Moz DotBot',
      'crawler',
    );
  });

  it('detects DotBot (bare token)', () => {
    expectBot(detectBot('DotBot/1.2'), 'Moz DotBot', 'crawler');
  });

  it('detects DotBot case-insensitively', () => {
    expectBot(detectBot('dotbot/1.2'), 'Moz DotBot', 'crawler');
  });
});

// ─── Meta ─────────────────────────────────────────────────────────────────────

describe('Meta bots', () => {
  it('detects Meta-ExternalAgent (ai_inference)', () => {
    expectBot(
      detectBot('Meta-ExternalAgent/1.1 (+https://www.facebook.com/externalhit_uatext.php)'),
      'Meta Meta-ExternalAgent',
      'ai_inference',
    );
  });

  it('detects Meta-ExternalAgent (bare token)', () => {
    expectBot(detectBot('Meta-ExternalAgent/1.0'), 'Meta Meta-ExternalAgent', 'ai_inference');
  });

  it('detects Meta-ExternalAgent case-insensitively', () => {
    expectBot(detectBot('meta-externalagent/1.0'), 'Meta Meta-ExternalAgent', 'ai_inference');
  });

  it('Meta-ExternalAgent takes priority over facebookexternalhit on composite UA', () => {
    expectBot(
      detectBot('Meta-ExternalAgent/1.1 facebookexternalhit/1.1'),
      'Meta Meta-ExternalAgent',
      'ai_inference',
    );
  });

  it('detects facebookexternalhit (social) with full UA', () => {
    const result = detectBot('facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)');
    expect(result.isBot).toBe(true);
    expect(result.botName).toBe('Meta facebookexternalhit');
    expect(result.type).toBe('social');
    expect(result.confidence).toBe(0.9);
  });

  it('detects facebookexternalhit case-insensitively', () => {
    const result = detectBot('FACEBOOKEXTERNALHIT/1.1');
    expect(result.isBot).toBe(true);
    expect(result.botName).toBe('Meta facebookexternalhit');
    expect(result.type).toBe('social');
  });
});

// ─── Real browsers — must NOT be detected as bots ─────────────────────────────

describe('human browsers — must not be detected as bots', () => {
  const browsers = [
    ['Chrome (macOS)', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'],
    ['Firefox (Windows)', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0'],
    ['Safari (iOS)', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'],
    ['Edge (Windows)', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0'],
    ['curl', 'curl/8.7.1'],
  ] as const;

  for (const [label, ua] of browsers) {
    it(`does not flag ${label}`, () => {
      expectHuman(detectBot(ua));
    });
  }
});

// ─── Type coverage ────────────────────────────────────────────────────────────

describe('BotType coverage', () => {
  const cases: Array<[string, string, BotType]> = [
    ['GPTBot/1.0',                    'OpenAI GPTBot',                 'ai_training'],
    ['ChatGPT-User/1.0',              'OpenAI ChatGPT-User',           'ai_inference'],
    ['anthropic-ai/1.0',              'Anthropic anthropic-ai',        'ai_training'],
    ['Claude-Web/1.0',                'Anthropic Claude-Web',          'ai_inference'],
    ['claude-bot/1.0',                'Anthropic claude-bot',          'ai_inference'],
    ['cohere-ai/1.0',                 'Cohere cohere-ai',              'ai_training'],
    ['CCBot/2.0',                     'Common Crawl CCBot',            'ai_training'],
    ['Google-Extended',               'Google Google-Extended',        'ai_training'],
    ['PerplexityBot/1.0',             'Perplexity PerplexityBot',      'ai_inference'],
    ['PerplexitySearchBot/1.0',       'Perplexity PerplexitySearchBot','ai_inference'],
    ['YouBot/1.0',                    'You.com YouBot',                'ai_inference'],
    ['Meta-ExternalAgent/1.0',        'Meta Meta-ExternalAgent',       'ai_inference'],
    ['Googlebot/2.1',                 'Google Googlebot',              'search'],
    ['bingbot/2.0',                   'Microsoft bingbot',             'search'],
    ['SemrushBot/7',                  'Semrush SemrushBot',            'crawler'],
    ['AhrefsBot/7.0',                 'Ahrefs AhrefsBot',              'crawler'],
    ['DotBot/1.2',                    'Moz DotBot',                    'crawler'],
    ['facebookexternalhit/1.1',       'Meta facebookexternalhit',      'social'],
  ];

  for (const [ua, expectedName, expectedType] of cases) {
    it(`${expectedName} → type="${expectedType}"`, () => {
      const result = detectBot(ua);
      expect(result.isBot).toBe(true);
      expect(result.botName).toBe(expectedName);
      expect(result.type).toBe(expectedType);
    });
  }
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('returns not-a-bot for empty string', () => {
    expectHuman(detectBot(''));
  });

  it('returns not-a-bot for whitespace-only string', () => {
    expectHuman(detectBot('   '));
  });

  it('handles leading/trailing whitespace around a bot UA', () => {
    expectBot(detectBot('  GPTBot/1.0  '), 'OpenAI GPTBot', 'ai_training');
  });

  it('returns the first match when a UA contains multiple bot tokens', () => {
    const result = detectBot('GPTBot/1.0 CCBot/2.0');
    expect(result.isBot).toBe(true);
    expect(result.botName).toBe('OpenAI GPTBot');
    expect(result.type).toBe('ai_training');
  });

  it('type is null when isBot is false', () => {
    expect(detectBot('curl/8.7.1').type).toBeNull();
    expect(detectBot('').type).toBeNull();
  });

  it('confidence is between 0 and 1 for every known bot', () => {
    const knownBots = [
      'GPTBot/1.0', 'ChatGPT-User/1.0',
      'Claude-Web/1.0', 'anthropic-ai/1.0', 'claude-bot/1.0',
      'Googlebot/2.1', 'Google-Extended', 'bingbot/2.0',
      'PerplexityBot/1.0', 'PerplexitySearchBot/1.0',
      'YouBot/1.0', 'cohere-ai/1.0',
      'CCBot/2.0',
      'SemrushBot/7', 'AhrefsBot/7.0', 'DotBot/1.2',
      'Meta-ExternalAgent/1.0', 'facebookexternalhit/1.1',
    ];
    for (const ua of knownBots) {
      const { confidence } = detectBot(ua);
      expect(confidence, `confidence out of range for ${ua}`).toBeGreaterThan(0);
      expect(confidence, `confidence out of range for ${ua}`).toBeLessThanOrEqual(1);
    }
  });
});
