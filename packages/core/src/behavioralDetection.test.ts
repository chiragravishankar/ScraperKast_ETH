import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzeBehavior,
  clearBehavioralHistory,
  type RequestContext,
  type BehaviorSignals,
} from './behavioralAnalysis.js';
import { calculateBotScore, interpretScore } from './botScoring.js';
import { detectBot, detectBotEnhanced } from './botDetection.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Realistic Chrome headers that a real browser sends. */
const REAL_BROWSER_HEADERS: RequestContext['headers'] = {
  'accept':           'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language':  'en-US,en;q=0.9',
  'accept-encoding':  'gzip, deflate, br',
  'cookie':           'session=abc123; _ga=GA1.2.1234',
  'referer':          'https://www.google.com',
  'sec-fetch-dest':   'document',
  'sec-fetch-mode':   'navigate',
  'sec-fetch-site':   'cross-site',
  'sec-ch-ua':        '"Google Chrome";v="124", "Chromium";v="124"',
  'sec-ch-ua-mobile': '?0',
};

const CHROME_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const FAKE_CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function makeCtx(overrides: Partial<RequestContext> & { ip?: string } = {}): RequestContext {
  return {
    userAgent: CHROME_UA,
    ip:        '203.0.113.99',
    headers:   {},
    path:      '/article',
    timestamp: Date.now(),
    ...overrides,
  };
}

// ─── Reset state between tests ────────────────────────────────────────────────

beforeEach(() => {
  clearBehavioralHistory();
});

// ─── 1. User-Agent detection — unchanged behaviour ────────────────────────────

describe('User-Agent detection (backward compat)', () => {
  it('detects GPTBot with 100% confidence via UA fast path', () => {
    const result = detectBot('Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)');
    expect(result.isBot).toBe(true);
    expect(result.botName).toBe('OpenAI GPTBot');
    expect(result.confidence).toBe(1);
    expect(result.type).toBe('ai_training');
  });

  it('detectBotEnhanced returns method=user-agent for known bot UAs', () => {
    const result = detectBotEnhanced(makeCtx({ userAgent: 'GPTBot/1.0' }));
    expect(result.isBot).toBe(true);
    expect(result.method).toBe('user-agent');
    expect(result.confidence).toBe(1);
    // Behavioral analysis should NOT have run.
    expect(result.behavioralScore).toBeUndefined();
  });

  it('detectBotEnhanced returns method=user-agent for ClaudeBot', () => {
    const result = detectBotEnhanced(makeCtx({ userAgent: 'claude-bot/1.0' }));
    expect(result.isBot).toBe(true);
    expect(result.method).toBe('user-agent');
  });

  it('detectBotEnhanced skips behavioral analysis when enableBehavioral=false', () => {
    const result = detectBotEnhanced(makeCtx({ userAgent: FAKE_CHROME_UA }), false);
    expect(result.isBot).toBe(false);
    expect(result.method).toBe('none');
    expect(result.behavioralScore).toBeUndefined();
  });
});

// ─── 2. BehaviorSignals: individual signal extraction ─────────────────────────

describe('analyzeBehavior — signal extraction', () => {
  it('hasCookies is true when Cookie header is present', () => {
    const signals = analyzeBehavior(makeCtx({ headers: { 'cookie': 'sid=xyz' } }));
    expect(signals.hasCookies).toBe(true);
  });

  it('hasCookies is false when Cookie header is absent', () => {
    const signals = analyzeBehavior(makeCtx({ headers: {} }));
    expect(signals.hasCookies).toBe(false);
  });

  it('hasReferer is true for Referer header', () => {
    const signals = analyzeBehavior(makeCtx({ headers: { 'referer': 'https://example.com' } }));
    expect(signals.hasReferer).toBe(true);
  });

  it('hasReferer is true for Referrer header (alternate spelling)', () => {
    const signals = analyzeBehavior(makeCtx({ headers: { 'referrer': 'https://example.com' } }));
    expect(signals.hasReferer).toBe(true);
  });

  it('hasReferer is false when neither header is present', () => {
    const signals = analyzeBehavior(makeCtx({ headers: {} }));
    expect(signals.hasReferer).toBe(false);
  });

  it('javascriptEnabled is true when sec-fetch-dest header present', () => {
    const signals = analyzeBehavior(makeCtx({ headers: { 'sec-fetch-dest': 'document' } }));
    expect(signals.javascriptEnabled).toBe(true);
  });

  it('javascriptEnabled is true when cookies + referer present (JS ran on prior page)', () => {
    const signals = analyzeBehavior(makeCtx({
      headers: { 'cookie': 'x=1', 'referer': 'https://example.com' },
    }));
    expect(signals.javascriptEnabled).toBe(true);
  });

  it('javascriptEnabled is false when no JS signals', () => {
    const signals = analyzeBehavior(makeCtx({ headers: {} }));
    expect(signals.javascriptEnabled).toBe(false);
  });

  it('missingHeaders lists absent required headers', () => {
    const signals = analyzeBehavior(makeCtx({ headers: { 'accept': 'text/html' } }));
    expect(signals.missingHeaders).toContain('accept-language');
    expect(signals.missingHeaders).toContain('accept-encoding');
    expect(signals.missingHeaders).not.toContain('accept');
  });

  it('missingHeaders is empty when all required headers present', () => {
    const signals = analyzeBehavior(makeCtx({
      headers: { 'accept': 'text/html', 'accept-language': 'en', 'accept-encoding': 'gzip' },
    }));
    expect(signals.missingHeaders).toHaveLength(0);
  });
});

// ─── 3. Fingerprint analysis ──────────────────────────────────────────────────

describe('analyzeBehavior — browser fingerprint', () => {
  it('suspiciousFingerprint is true when Chrome 90+ UA but no sec-ch-ua', () => {
    const signals = analyzeBehavior(makeCtx({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      headers:   { 'accept-language': 'en-US', 'accept': 'text/html', 'accept-encoding': 'gzip' },
      // No sec-ch-ua header
    }));
    expect(signals.suspiciousFingerprint).toBe(true);
  });

  it('suspiciousFingerprint is false when Chrome UA has matching sec-ch-ua', () => {
    const signals = analyzeBehavior(makeCtx({
      userAgent: CHROME_UA,
      headers:   { ...REAL_BROWSER_HEADERS },
    }));
    expect(signals.suspiciousFingerprint).toBe(false);
  });

  it('suspiciousFingerprint is true when Mozilla/5.0 UA missing Accept-Language', () => {
    const signals = analyzeBehavior(makeCtx({
      userAgent: 'Mozilla/5.0 (Firefox/125.0)',
      headers:   { 'accept': 'text/html', 'accept-encoding': 'gzip' },
      // No accept-language
    }));
    expect(signals.suspiciousFingerprint).toBe(true);
  });

  it('suspiciousFingerprint is true when WebDriver header present', () => {
    const signals = analyzeBehavior(makeCtx({
      headers: { 'webdriver': 'true', 'accept-language': 'en', 'sec-ch-ua': 'Chrome' },
    }));
    expect(signals.suspiciousFingerprint).toBe(true);
  });
});

// ─── 4. High-RPS detection (Firecrawl / BrightData pattern) ──────────────────

describe('High RPS detection', () => {
  it('detects > 10 req/s from the same IP', () => {
    const ip  = '198.51.100.1';
    const now = Date.now();

    // 14 requests at ~50 ms intervals → ≈18 req/s over 700 ms window.
    for (let i = 0; i < 14; i++) {
      analyzeBehavior(makeCtx({ ip, timestamp: now + i * 50 }));
    }

    const signals = analyzeBehavior(makeCtx({ ip, timestamp: now + 700 }));
    expect(signals.requestsPerSecond).toBeGreaterThan(10);
  });

  it('high RPS contributes 30 points to bot score', () => {
    const signals: BehaviorSignals = {
      requestsPerSecond:     15,
      sequentialPattern:     false,
      missingHeaders:        [],
      hasCookies:            true,
      hasReferer:            true,
      javascriptEnabled:     true,
      suspiciousFingerprint: false,
    };
    expect(calculateBotScore(signals)).toBe(30);
  });

  it('detectBotEnhanced returns isBot=true for high-RPS Chrome UA (≥ 85% confidence)', () => {
    const ip  = '198.51.100.2';
    const now = Date.now();

    // Warm up history: 14 requests with minimal headers (no cookies/referer/sec-ch-ua).
    for (let i = 0; i < 14; i++) {
      analyzeBehavior({
        userAgent: FAKE_CHROME_UA,
        ip,
        headers:   {},           // missing required headers
        path:      '/article',
        timestamp: now + i * 50,
      });
    }

    const result = detectBotEnhanced({
      userAgent: FAKE_CHROME_UA,
      ip,
      headers:   {},
      path:      '/article',
      timestamp: now + 700,
    });

    expect(result.isBot).toBe(true);
    expect(result.method).toBe('behavioral');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.behavioralScore).toBeGreaterThanOrEqual(70);
    expect(result.botName).toBe('Commercial Scraper');
    expect(result.type).toBe('unknown');
  });
});

// ─── 5. Sequential scraping detection ─────────────────────────────────────────

describe('Sequential path detection', () => {
  it('detects /page/1 → /page/2 → /page/3 → /page/4 pattern', () => {
    const ip  = '198.51.100.3';
    const now = Date.now();

    for (const [i, path] of ['/page/1', '/page/2', '/page/3'].entries()) {
      analyzeBehavior(makeCtx({ ip, path, timestamp: now + i * 500 }));
    }

    const signals = analyzeBehavior(makeCtx({ ip, path: '/page/4', timestamp: now + 1500 }));
    expect(signals.sequentialPattern).toBe(true);
  });

  it('detects article-N sequential pattern', () => {
    const ip  = '198.51.100.4';
    const now = Date.now();

    for (const [i, path] of ['/article-5', '/article-6', '/article-7'].entries()) {
      analyzeBehavior(makeCtx({ ip, path, timestamp: now + i * 300 }));
    }

    const signals = analyzeBehavior(makeCtx({ ip, path: '/article-8', timestamp: now + 900 }));
    expect(signals.sequentialPattern).toBe(true);
  });

  it('does not flag random non-sequential access', () => {
    const ip  = '198.51.100.5';
    const now = Date.now();

    for (const [i, path] of ['/home', '/about', '/blog', '/contact'].entries()) {
      analyzeBehavior(makeCtx({ ip, path, timestamp: now + i * 2000 }));
    }

    const signals = analyzeBehavior(makeCtx({ ip, path: '/pricing', timestamp: now + 8000 }));
    expect(signals.sequentialPattern).toBe(false);
  });

  it('sequential pattern contributes 25 points', () => {
    const signals: BehaviorSignals = {
      requestsPerSecond:     0,
      sequentialPattern:     true,
      missingHeaders:        [],
      hasCookies:            true,
      hasReferer:            true,
      javascriptEnabled:     true,
      suspiciousFingerprint: false,
    };
    expect(calculateBotScore(signals)).toBe(25);
  });

  it('detectBotEnhanced returns isBot=true for sequential scraper (≥ 70% confidence)', () => {
    const ip  = '198.51.100.6';
    const now = Date.now();

    // 5 sequential pages, minimal headers (no cookies/sec-ch-ua/referer → more signals).
    for (const [i, path] of ['/post/1', '/post/2', '/post/3', '/post/4'].entries()) {
      analyzeBehavior({
        userAgent: FAKE_CHROME_UA,
        ip,
        headers:   {},
        path,
        timestamp: now + i * 800,
      });
    }

    const result = detectBotEnhanced({
      userAgent: FAKE_CHROME_UA,
      ip,
      headers:   {},
      path:      '/post/5',
      timestamp: now + 3200,
    });

    expect(result.isBot).toBe(true);
    expect(result.method).toBe('behavioral');
    expect(result.confidence).toBeGreaterThanOrEqual(0.70);
  });
});

// ─── 6. Normal users must NOT be flagged ─────────────────────────────────────

describe('Normal users — must not be flagged', () => {
  it('real Chrome browser with all signals has score < 30', () => {
    const signals = analyzeBehavior({
      userAgent: CHROME_UA,
      ip:        '203.0.113.10',
      headers:   REAL_BROWSER_HEADERS,
      path:      '/blog/my-article',
      timestamp: Date.now(),
    });

    const score = calculateBotScore(signals);
    expect(score).toBeLessThan(30);
  });

  it('detectBotEnhanced returns isBot=false for real Chrome user', () => {
    const result = detectBotEnhanced({
      userAgent: CHROME_UA,
      ip:        '203.0.113.11',
      headers:   REAL_BROWSER_HEADERS,
      path:      '/blog/my-article',
      timestamp: Date.now(),
    });

    expect(result.isBot).toBe(false);
    expect(result.method).toBe('behavioral');
  });

  it('low-frequency browsing (1 req/min) stays below threshold', () => {
    const ip  = '203.0.113.12';
    const now = Date.now();

    // Simulate 3 requests spaced 1 minute apart — no RPS concern.
    for (let i = 0; i < 2; i++) {
      analyzeBehavior({
        userAgent: CHROME_UA,
        ip,
        headers:   REAL_BROWSER_HEADERS,
        path:      '/article',
        timestamp: now - (2 - i) * 60_000,
      });
    }

    const result = detectBotEnhanced({
      userAgent: CHROME_UA,
      ip,
      headers:   REAL_BROWSER_HEADERS,
      path:      '/article',
      timestamp: now,
    });

    expect(result.isBot).toBe(false);
  });

  it('Firefox browser (no sec-ch-ua but has accept-language) is not flagged', () => {
    const result = detectBotEnhanced({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
      ip:        '203.0.113.13',
      headers:   {
        'accept':          'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
        'cookie':          'session=xyz',
        'referer':         'https://example.com',
      },
      path:      '/news',
      timestamp: Date.now(),
    });

    // Firefox doesn't send sec-ch-ua, but that only fires the Chrome check.
    expect(result.isBot).toBe(false);
  });
});

// ─── 7. Bot scoring — full table ──────────────────────────────────────────────

describe('calculateBotScore', () => {
  it('all-clear signals → score 0', () => {
    const signals: BehaviorSignals = {
      requestsPerSecond:     0,
      sequentialPattern:     false,
      missingHeaders:        [],
      hasCookies:            true,
      hasReferer:            true,
      javascriptEnabled:     true,
      suspiciousFingerprint: false,
    };
    expect(calculateBotScore(signals)).toBe(0);
  });

  it('worst-case bot → score 100 (capped)', () => {
    const signals: BehaviorSignals = {
      requestsPerSecond:     20,  // 30
      sequentialPattern:     true,  // 25
      missingHeaders:        ['accept', 'accept-language', 'accept-encoding', 'x-dummy'],  // 20 (cap)
      hasCookies:            false,  // 10
      hasReferer:            false,  // 5
      javascriptEnabled:     false,  // 20
      suspiciousFingerprint: true,   // 15
    };
    // 30 + 25 + 20 + 10 + 5 + 20 + 15 = 125 → capped at 100
    expect(calculateBotScore(signals)).toBe(100);
  });

  it('moderate signals (RPS 5-10) → 20 pts', () => {
    const signals: BehaviorSignals = {
      requestsPerSecond:     8,
      sequentialPattern:     false,
      missingHeaders:        [],
      hasCookies:            true,
      hasReferer:            true,
      javascriptEnabled:     true,
      suspiciousFingerprint: false,
    };
    expect(calculateBotScore(signals)).toBe(20);
  });

  it('missing headers capped at 20 pts regardless of count', () => {
    const signals: BehaviorSignals = {
      requestsPerSecond:     0,
      sequentialPattern:     false,
      missingHeaders:        ['accept', 'accept-language', 'accept-encoding', 'x-extra'],
      hasCookies:            true,
      hasReferer:            true,
      javascriptEnabled:     true,
      suspiciousFingerprint: false,
    };
    // 4 missing × 5 = 20 (not 20+)
    expect(calculateBotScore(signals)).toBe(20);
  });
});

// ─── 8. Score interpretation ──────────────────────────────────────────────────

describe('interpretScore', () => {
  it('score 80+ → Bot 95%', () => {
    const r = interpretScore(85);
    expect(r.isBot).toBe(true);
    expect(r.confidence).toBe(0.95);
  });

  it('score 70-79 → Bot 85%', () => {
    const r = interpretScore(75);
    expect(r.isBot).toBe(true);
    expect(r.confidence).toBe(0.85);
  });

  it('score 50-69 → Bot 70%', () => {
    const r = interpretScore(60);
    expect(r.isBot).toBe(true);
    expect(r.confidence).toBe(0.70);
  });

  it('score 30-49 → Not bot 60%', () => {
    const r = interpretScore(40);
    expect(r.isBot).toBe(false);
    expect(r.confidence).toBe(0.60);
  });

  it('score 0-29 → Not bot 90%', () => {
    const r = interpretScore(10);
    expect(r.isBot).toBe(false);
    expect(r.confidence).toBe(0.90);
  });

  it('score exactly 50 → Bot 70%', () => {
    expect(interpretScore(50).isBot).toBe(true);
  });

  it('score exactly 30 → Not bot 60%', () => {
    expect(interpretScore(30).isBot).toBe(false);
  });
});

// ─── 9. Memory management ─────────────────────────────────────────────────────

describe('Memory management', () => {
  it('clearBehavioralHistory wipes all state', () => {
    const ip  = '198.51.100.10';
    const now = Date.now();

    // Build up history.
    for (let i = 0; i < 10; i++) {
      analyzeBehavior(makeCtx({ ip, timestamp: now + i * 50 }));
    }

    clearBehavioralHistory();

    // After clear, RPS should reset to 1 (just this one request).
    const signals = analyzeBehavior(makeCtx({ ip, timestamp: now + 500 }));
    expect(signals.requestsPerSecond).toBe(1);
  });

  it('requests older than 60 seconds are excluded from RPS', () => {
    const ip  = '198.51.100.11';
    const now = Date.now();

    // Record a request 70 seconds ago (outside the 60-second window).
    analyzeBehavior(makeCtx({ ip, timestamp: now - 70_000 }));

    // A current request — the old one should NOT be counted in RPS.
    const signals = analyzeBehavior(makeCtx({ ip, timestamp: now }));
    expect(signals.requestsPerSecond).toBeLessThanOrEqual(2);
  });

  it('path history is bounded to 10 entries per IP', () => {
    const ip  = '198.51.100.12';
    const now = Date.now();

    // Push 12 paths.
    for (let i = 0; i < 12; i++) {
      analyzeBehavior(makeCtx({ ip, path: `/page/${i}`, timestamp: now + i * 100 }));
    }

    // Sequential pattern uses last 10 paths.  With paths /page/2…/page/12
    // there should still be a sequential pattern detected (≥ 3 in a row).
    const signals = analyzeBehavior(makeCtx({ ip, path: '/page/13', timestamp: now + 1300 }));
    expect(signals.sequentialPattern).toBe(true);
  });

  it('different IPs are tracked independently', () => {
    const now = Date.now();
    const ip1 = '198.51.100.20';
    const ip2 = '198.51.100.21';

    // Flood ip1 with requests.
    for (let i = 0; i < 15; i++) {
      analyzeBehavior(makeCtx({ ip: ip1, timestamp: now + i * 40 }));
    }

    // ip2 makes a single request — should not inherit ip1's history.
    const signals2 = analyzeBehavior(makeCtx({ ip: ip2, timestamp: now + 600 }));
    expect(signals2.requestsPerSecond).toBe(1);
  });
});
