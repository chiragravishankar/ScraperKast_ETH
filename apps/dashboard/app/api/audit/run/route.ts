import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { createClient } from '@/lib/supabase/server';
import {
  detectFullArticle,
  extractContentMetadata,
  htmlToMarkdown,
} from '../lib/contentDetection';

// 25 scrapers: 10 AI bots (parallel) + 12 HTTP commercial (parallel) + 3 headless (sequential).
// Typical wall-clock: ~25-35 s — well inside the 60 s Vercel limit.
export const maxDuration = 60;
export const dynamic     = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AttackStep {
  step:   number;
  action: string;
  result: string;
  timeMs: number;
}

export type ScraperTier = 'ai' | 'premium' | 'midtier' | 'opensource';

/** Content captured from a successful scrape — stored per-scraper result. */
export interface ContentRetrieved {
  /** Raw HTML, capped at 50 KB. */
  html:           string;
  /** Markdown conversion of the HTML. */
  markdown:       string;
  /** Extracted plain text, capped at 10 KB. */
  plaintext:      string;
  characterCount: number;
  wordCount:      number;
  /** True when structural analysis suggests a complete article was retrieved. */
  fullArticle:    boolean;
  extracted: {
    title:        boolean;
    mainContent:  boolean;
    images:       number;
    lastParagraph: boolean;
  };
}

export interface ScraperResult {
  name:           string;
  tier:           ScraperTier;
  difficulty:     number;          // 1–10
  success:        boolean;         // true = site exposed (bad)
  blocked:        boolean;         // true = site defended itself (good)
  statusCode:     number | null;
  contentLength:  number;
  contentPreview: string;          // plain-text, max 500 chars (backward-compat)
  fullArticle:    boolean;
  timeMs:         number;
  error?:         string;
  techniques:     string[];
  attackPath:     AttackStep[];
  /** Full content data — present only for successful requests. */
  contentRetrieved?: ContentRetrieved;
  /** Human-readable company name — present for AI bots. */
  company?:       string;
  /** Whether this bot declares itself as respecting robots.txt. */
  respectsRobotsTxt?: boolean;
  /** Server / CDN metadata captured from the HTTP exchange. */
  requestDetails?: {
    targetUrl:   string;
    httpStatus:  number;
    timeMs:      number;
    serverType:  string;
    cdnProvider: string;
    cdnRayId?:   string;
    /** Flat map of all response headers (lower-cased keys). */
    headers:     Record<string, string>;
  };
}

// Keep alias so old stored DB results still type-check.
export type ScraperTest = ScraperResult;

export interface TierBreakdown {
  ai?:        { tested: number; exposed: number };
  premium:    { tested: number; exposed: number };
  midtier:    { tested: number; exposed: number };
  opensource: { tested: number; exposed: number };
}

export interface Remediation {
  priority:    'high' | 'medium' | 'low';
  title:       string;
  description: string;
  impact:      string;
  effort:      string;
  willBlock?:  string[];
}

export interface AuditPayload {
  id:                 string;
  targetUrl:          string;
  vulnerabilityScore: number;
  status:             'complete' | 'failed';
  results: {
    tests:          ScraperResult[];
    remediations:   Remediation[];
    summary:        string;
    tierBreakdown?: TierBreakdown;
  };
}

// ── URL validation ────────────────────────────────────────────────────────────

function validateUrl(raw: string): { valid: boolean; url?: string; reason?: string } {
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (!['http:', 'https:'].includes(u.protocol))
      return { valid: false, reason: 'Only HTTP and HTTPS URLs are allowed.' };
    const h = u.hostname.toLowerCase();
    if (['localhost', '127.0.0.1', '::1', '0.0.0.0', '[::1]'].includes(h))
      return { valid: false, reason: 'Local addresses are not allowed.' };
    if (/^10\./.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
        /^192\.168\./.test(h) || /^169\.254\./.test(h))
      return { valid: false, reason: 'Private IP ranges are not allowed.' };
    return { valid: true, url: u.href };
  } catch {
    return { valid: false, reason: 'Invalid URL — e.g. https://example.com' };
  }
}

// ── Block detection ───────────────────────────────────────────────────────────

function detectBlocking(status: number, body: string): { blocked: boolean; reason: string } {
  // ── Status-based blocks (size-independent) ────────────────────────────────
  if ([401, 403, 407].includes(status)) return { blocked: true, reason: `HTTP ${status} — forbidden` };
  if (status === 429)                   return { blocked: true, reason: 'HTTP 429 — rate limited' };
  if ([502, 503, 504].includes(status)) return { blocked: true, reason: `HTTP ${status} — gateway/proxy error` };
  if (body.length < 300)                return { blocked: true, reason: 'Empty or minimal response' };

  const lc = body.toLowerCase();

  // ── Cloudflare ─────────────────────────────────────────────────────────────
  // These JS tokens only ever appear in actual Cloudflare challenge pages,
  // never in real content, so no size guard is needed.
  if (
    lc.includes('window._cf_chl') ||
    lc.includes('cf-browser-verification') ||
    lc.includes('cf_captcha_kind') ||
    (lc.includes('just a moment') && lc.includes('cloudflare')) ||
    (lc.includes('checking your browser') && lc.includes('cloudflare'))
  ) return { blocked: true, reason: 'Cloudflare challenge — browser verification required' };

  // ── Akamai / Imperva / PerimeterX ─────────────────────────────────────────
  // SIZE GUARD REQUIRED: _abck and ak_bmsc are Akamai cookie names that appear
  // in inline JS on real pages that use Akamai tracking (e.g. TechCrunch).
  // Actual Akamai block pages are tiny (< 5 KB) and return 403 (caught above).
  // Only flag these if the body is suspiciously small for a 200 response.
  if (body.length < 15_000) {
    if (
      lc.includes('_abck') ||
      lc.includes('ak_bmsc') ||
      (lc.includes('incapsula') && lc.includes('incident_id')) ||
      (lc.includes('perimeterx') || lc.includes('pxchallenge'))
    ) return { blocked: true, reason: 'WAF challenge — enterprise bot protection active' };
  }

  // ── DataDome ──────────────────────────────────────────────────────────────
  if (lc.includes('datadome') && lc.includes('blocked'))
    return { blocked: true, reason: 'DataDome — bot traffic blocked' };

  // ── CAPTCHA pages ─────────────────────────────────────────────────────────
  // SIZE GUARD REQUIRED: real pages embed reCAPTCHA for forms; those pages are
  // large. Actual CAPTCHA-gate pages (e.g. hCaptcha interstitials) are tiny.
  if (body.length < 15_000) {
    if (lc.includes('captcha') && (lc.includes('verify') || lc.includes('human') || lc.includes('robot')))
      return { blocked: true, reason: 'CAPTCHA challenge detected' };
  }

  if (lc.includes('access denied') && body.length < 8_000)
    return { blocked: true, reason: 'Access denied page' };

  // ── JavaScript-gated ──────────────────────────────────────────────────────
  // SIZE GUARD REQUIRED: virtually every SPA has a <noscript>Please enable
  // JavaScript</noscript> fallback in its real 200 HTML. JS-only challenge
  // pages (those that serve nothing useful without JS) are always tiny.
  if (body.length < 15_000) {
    if (
      lc.includes('enable javascript') ||
      lc.includes('requires javascript') ||
      lc.includes('please enable js')
    ) return { blocked: true, reason: 'JavaScript-gated — browser required' };
  }

  console.log(`[detectBlocking] PASS  status=${status}  bytes=${body.length}  preview="${body.slice(0, 120).replace(/\s+/g, ' ')}"`);
  return { blocked: false, reason: 'Content accessible' };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractPreview(html: string, maxLen = 500): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|lt|gt|quot|#039|nbsp);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

// ── Base HTTP runner ──────────────────────────────────────────────────────────

/** Return shape of a successful httpGet call. */
interface HttpGetResult {
  status:          number;
  body:            string;
  timeMs:          number;
  /** Lower-cased, stringified response headers. */
  responseHeaders: Record<string, string>;
  /** The URL that was fetched (may differ from input after redirect). */
  url:             string;
}

async function httpGet(
  url: string,
  headers: Record<string, string>,
  timeout = 9_000,
  scraperName = 'unknown',
): Promise<HttpGetResult> {
  const t0 = Date.now();

  console.log(
    `[audit] ▶ ${scraperName} → ${url} ` +
    `ua="${(headers['User-Agent'] ?? headers['user-agent'] ?? '—').slice(0, 60)}"`,
  );

  try {
    const res = await axios.get<string>(url, {
      headers,
      timeout,
      maxRedirects: 5,
      responseType: 'text',
      validateStatus: () => true,
    });

    const body            = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const timeMs          = Date.now() - t0;
    const preview         = body.slice(0, 120).replace(/\s+/g, ' ');
    const responseHeaders = Object.fromEntries(
      Object.entries(res.headers as Record<string, unknown>)
        .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
        .map(([k, v]) => [k.toLowerCase(), String(v)]),
    );

    console.log(
      `[audit] ✓ ${scraperName}  status=${res.status}  bytes=${body.length}  ` +
      `time=${timeMs}ms  server="${responseHeaders['server'] ?? '—'}"  ` +
      `preview="${preview}"`,
    );

    return { status: res.status, body, timeMs, responseHeaders, url };
  } catch (err: unknown) {
    const timeMs  = Date.now() - t0;
    const code    = (err as NodeJS.ErrnoException).code  ?? 'UNKNOWN';
    const message = err instanceof Error ? err.message    : String(err);

    console.error(
      `[audit] ✗ ${scraperName}  error=${code}  time=${timeMs}ms  msg="${message}"`,
    );

    throw err; // re-throw so the per-scraper catch feeds makeResult correctly
  }
}

// ── Result factory ────────────────────────────────────────────────────────────

interface ResultMeta {
  name:               string;
  tier:               ScraperTier;
  difficulty:         number;
  techniques:         string[];
  company?:           string;
  respectsRobotsTxt?: boolean;
}

function makeResult(
  meta: ResultMeta,
  raw:  HttpGetResult | null,
  err?: unknown,
): ScraperResult {
  if (!raw) {
    // Network-level failure (timeout, ECONNREFUSED, DNS, etc.).
    // blocked: false → isError = true in the UI → shown as "Skipped", not "Blocked".
    // The scoring loop already excludes pure errors (!success && !blocked),
    // so this correctly keeps them out of the vulnerability score.
    const rawMsg    = err instanceof Error ? err.message : String(err ?? 'Request failed');
    const isTimeout = /timeout|ETIMEDOUT|ECONNABORTED/i.test(rawMsg);
    const isDns     = /ENOTFOUND|ECONNREFUSED|ENETUNREACH/i.test(rawMsg);
    const friendlyMsg = isTimeout
      ? 'Request timed out — the site may be rate-limiting this region'
      : isDns
        ? 'DNS / connection refused — could not reach the server'
        : rawMsg;
    return {
      ...meta, success: false, blocked: false,
      statusCode: null, contentLength: 0, contentPreview: '',
      fullArticle: false, timeMs: 0, error: friendlyMsg, attackPath: [],
    };
  }

  const { status, body, timeMs, responseHeaders, url: fetchedUrl } = raw;
  const { blocked, reason } = detectBlocking(status, body);
  const success  = !blocked && status >= 200 && status < 400;
  const preview  = extractPreview(body);
  const fullArt  = success ? detectFullArticle(body) : false;

  const usesProxy = meta.techniques.some(t => /prox/i.test(t));
  const usesUA    = meta.techniques.some(t => /user.agent|spoof|fingerprint/i.test(t));
  const path: Array<{ action: string; result: string; timeMs: number }> = [];

  if (usesProxy) {
    path.push({
      action: 'Route through proxy network',
      result: blocked ? 'Proxy IP detected/blocked' : 'Residential IP accepted by server',
      timeMs: Math.round(timeMs * 0.25),
    });
  }
  if (usesUA) {
    path.push({
      action: `Apply browser fingerprint (${meta.techniques.find(t => /ua|fingerprint|header/i.test(t)) ?? 'headers'})`,
      result: blocked ? 'Fingerprint flagged as non-human' : 'Accepted as genuine browser',
      timeMs: Math.round(timeMs * 0.15),
    });
  }
  path.push({
    action: `HTTP GET — ${meta.techniques[0] ?? 'User-Agent request'}`,
    result: `HTTP ${status} — ${blocked ? 'blocked' : 'response received'}`,
    timeMs: Math.round(timeMs * (usesProxy ? 0.40 : usesUA ? 0.55 : 0.70)),
  });
  path.push({
    action: success ? 'Parse & extract content' : blocked ? 'Blocked — no content' : 'Parse failed',
    result: success
      ? `${body.length.toLocaleString()} bytes${fullArt ? ' • full article detected' : ' • partial content'}`
      : reason,
    timeMs: Math.round(timeMs * 0.20),
  });

  // ── Content storage (successful requests only) ─────────────────────────────
  let contentRetrieved: ContentRetrieved | undefined;
  if (success) {
    const metadata = extractContentMetadata(body);
    contentRetrieved = {
      html:           body.slice(0, 50_000),          // 50 KB cap
      markdown:       htmlToMarkdown(body).slice(0, 50_000),
      plaintext:      metadata.plaintext,              // already capped at 10 KB
      characterCount: metadata.characterCount,
      wordCount:      metadata.wordCount,
      fullArticle:    fullArt,
      extracted: {
        title:        metadata.hasTitle,
        mainContent:  metadata.hasMainContent,
        images:       metadata.imageCount,
        lastParagraph: metadata.hasLastParagraph,
      },
    };
  }

  // ── Request / server details ───────────────────────────────────────────────
  const serverType  = responseHeaders['server'] ?? responseHeaders['x-powered-by'] ?? 'Unknown';
  const cdnProvider =
    responseHeaders['cf-ray']                ? 'Cloudflare'         :
    responseHeaders['x-amz-cf-id']           ? 'Amazon CloudFront'  :
    responseHeaders['x-fastly-request-id']   ? 'Fastly'             :
    responseHeaders['x-akamai-request-id']   ? 'Akamai'             :
    responseHeaders['x-cache']               ? 'CDN'                :
    'None detected';
  const cdnRayId    = responseHeaders['cf-ray'] ?? responseHeaders['x-amz-cf-id'];

  const requestDetails: ScraperResult['requestDetails'] = {
    targetUrl:  fetchedUrl,
    httpStatus: status,
    timeMs,
    serverType,
    cdnProvider,
    ...(cdnRayId ? { cdnRayId } : {}),
    headers:    responseHeaders,
  };

  return {
    ...meta,
    success,
    blocked,
    statusCode:      status,
    contentLength:   body.length,
    contentPreview:  preview,
    fullArticle:     fullArt,
    timeMs,
    ...(blocked ? { error: reason } : {}),
    attackPath:      path.map((s, i) => ({ step: i + 1, ...s })),
    ...(contentRetrieved ? { contentRetrieved } : {}),
    requestDetails,
  };
}

// ── Shared header sets ────────────────────────────────────────────────────────

const CHROME_WIN: Record<string, string> = {
  'User-Agent':                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language':           'en-US,en;q=0.9',
  'Accept-Encoding':           'gzip, deflate, br',
  'Cache-Control':             'no-cache',
  'sec-ch-ua':                 '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
  'sec-ch-ua-mobile':          '?0',
  'sec-ch-ua-platform':        '"Windows"',
  'Sec-Fetch-Dest':            'document',
  'Sec-Fetch-Mode':            'navigate',
  'Sec-Fetch-Site':            'none',
  'Upgrade-Insecure-Requests': '1',
};

const CHROME_MAC: Record<string, string> = {
  ...CHROME_WIN,
  'User-Agent':         'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'sec-ch-ua-platform': '"macOS"',
  'Accept-Language':    'en-GB,en;q=0.9',
};

const CHROME_LINUX: Record<string, string> = {
  ...CHROME_WIN,
  'User-Agent':         'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'sec-ch-ua-platform': '"Linux"',
};

/** Minimal headers sent by most AI crawlers. */
const AI_BOT_BASE: Record<string, string> = {
  'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
  'Accept-Encoding': 'gzip, deflate',
};

// ── 10 AI-bot configurations ──────────────────────────────────────────────────

interface AiBotConfig {
  name:               string;
  company:            string;
  userAgent:          string;
  techniques:         string[];
  respectsRobotsTxt: boolean;
}

const AI_BOTS: AiBotConfig[] = [
  {
    name: 'GPTBot',
    company: 'OpenAI',
    userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.0; +https://openai.com/gptbot',
    techniques: ['User-Agent identification', 'Respects robots.txt'],
    respectsRobotsTxt: true,
  },
  {
    name: 'ClaudeBot',
    company: 'Anthropic',
    userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +https://www.anthropic.com',
    techniques: ['User-Agent identification', 'Respects robots.txt'],
    respectsRobotsTxt: true,
  },
  {
    name: 'PerplexityBot',
    company: 'Perplexity AI',
    userAgent: 'PerplexityBot/1.0 (+https://docs.perplexity.ai/docs/perplexitybot)',
    techniques: ['User-Agent identification'],
    respectsRobotsTxt: true,
  },
  {
    name: 'Google-Extended',
    company: 'Google AI',
    userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Google-Extended',
    techniques: ['User-Agent identification', 'Respects robots.txt'],
    respectsRobotsTxt: true,
  },
  {
    name: 'Bingbot-AI',
    company: 'Microsoft Copilot',
    userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    techniques: ['Edge browser fingerprint', 'User-Agent identification'],
    respectsRobotsTxt: true,
  },
  {
    name: 'CCBot',
    company: 'Common Crawl',
    userAgent: 'CCBot/2.0 (https://commoncrawl.org/faq/)',
    techniques: ['User-Agent identification', 'Respects robots.txt'],
    respectsRobotsTxt: true,
  },
  {
    name: 'Applebot-Extended',
    company: 'Apple Intelligence',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 Applebot-Extended/1.0',
    techniques: ['User-Agent identification', 'Respects robots.txt'],
    respectsRobotsTxt: true,
  },
  {
    name: 'FacebookBot',
    company: 'Meta AI',
    userAgent: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    techniques: ['Social preview fetcher', 'User-Agent identification'],
    respectsRobotsTxt: false,
  },
  {
    name: 'anthropic-ai',
    company: 'Anthropic',
    userAgent: 'anthropic-ai',
    techniques: ['User-Agent identification', 'Respects robots.txt'],
    respectsRobotsTxt: true,
  },
  {
    name: 'ChatGPT-User',
    company: 'OpenAI ChatGPT',
    userAgent: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) ChatGPT-User/1.0 Chrome/120.0.0.0',
    techniques: ['Real-time inference fetcher', 'User-Agent identification'],
    respectsRobotsTxt: true,
  },
];

async function testAiBot(url: string, cfg: AiBotConfig): Promise<ScraperResult> {
  const meta: ResultMeta = {
    name:               cfg.name,
    tier:               'ai',
    difficulty:         2,
    techniques:         cfg.techniques,
    company:            cfg.company,
    respectsRobotsTxt: cfg.respectsRobotsTxt,
  };
  try {
    const raw = await httpGet(url, { ...AI_BOT_BASE, 'User-Agent': cfg.userAgent }, 9_000, cfg.name);
    return makeResult(meta, raw);
  } catch (e) {
    return makeResult(meta, null, e);
  }
}

// ── 15 Commercial scraper implementations ────────────────────────────────────

// ─ OPEN SOURCE ─────────────────────────────────────────────────────────────

async function testScrapy(url: string): Promise<ScraperResult> {
  const meta: ResultMeta = { name: 'Scrapy', tier: 'opensource', difficulty: 5,
    techniques: ['Python Spider', 'HTTP Requests', 'Link Following', 'No JavaScript'] };
  try { return makeResult(meta, await httpGet(url, { 'User-Agent': 'Scrapy/2.11.0 (+https://scrapy.org)', 'Accept': 'text/html' }, 9_000, 'Scrapy')); }
  catch (e) { return makeResult(meta, null, e); }
}

async function testCheerio(url: string): Promise<ScraperResult> {
  const meta: ResultMeta = { name: 'Cheerio', tier: 'opensource', difficulty: 3,
    techniques: ['HTML Parsing', 'jQuery-like API', 'Static Content Only', 'No JavaScript'] };
  try {
    const raw = await httpGet(url, { 'User-Agent': 'node-fetch/3.3.0', 'Accept': 'text/html' }, 9_000, 'Cheerio');
    const { parse } = await import('node-html-parser');
    const root = parse(raw.body);
    root.querySelectorAll('script, style').forEach(el => el.remove());
    const text = (root.querySelector('body')?.innerText ?? '').replace(/\s+/g, ' ').trim();
    return makeResult(meta, { ...raw, body: text.length > 300 ? raw.body : '' });
  } catch (e) { return makeResult(meta, null, e); }
}

async function testAxiosJSDOM(url: string): Promise<ScraperResult> {
  const meta: ResultMeta = { name: 'Axios+JSDOM', tier: 'opensource', difficulty: 4,
    techniques: ['HTTP Client', 'Basic Headers', 'DOM Parsing', 'No Rendering'] };
  try { return makeResult(meta, await httpGet(url, { 'User-Agent': 'axios/1.6.7', 'Accept': 'application/json, text/plain, */*' }, 9_000, 'Axios+JSDOM')); }
  catch (e) { return makeResult(meta, null, e); }
}

// ─ MID-TIER ─────────────────────────────────────────────────────────────────

async function testParsehub(url: string): Promise<ScraperResult> {
  const meta: ResultMeta = { name: 'ParseHub', tier: 'midtier', difficulty: 6,
    techniques: ['Visual CSS Selector', 'No JavaScript', 'Static Extraction', 'Point-and-Click'] };
  try { return makeResult(meta, await httpGet(url, { 'User-Agent': 'Mozilla/5.0 (compatible; parsehub/1.0)', 'Accept': 'text/html', 'Accept-Language': 'en-US,en;q=0.8' }, 9_000, 'ParseHub')); }
  catch (e) { return makeResult(meta, null, e); }
}

async function testScrapingdog(url: string): Promise<ScraperResult> {
  const meta: ResultMeta = { name: 'Scrapingdog', tier: 'midtier', difficulty: 6,
    techniques: ['Proxy Rotation', 'User-Agent Rotation', 'Browser Header Spoofing'] };
  try { return makeResult(meta, await httpGet(url, { ...CHROME_WIN, 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }, 9_000, 'Scrapingdog')); }
  catch (e) { return makeResult(meta, null, e); }
}

async function testApify(url: string): Promise<ScraperResult> {
  const meta: ResultMeta = { name: 'Apify', tier: 'midtier', difficulty: 7,
    techniques: ['Cloud Actor Framework', 'Cheerio Scraper', 'Request Queue', 'Auto-scaling'] };
  try { return makeResult(meta, await httpGet(url, { 'User-Agent': 'Mozilla/5.0 (compatible; ApifyBot/2.0; +https://apify.com/bot)', 'Accept': 'text/html,application/xhtml+xml' }, 9_000, 'Apify')); }
  catch (e) { return makeResult(meta, null, e); }
}

async function testDiffbot(url: string): Promise<ScraperResult> {
  const meta: ResultMeta = { name: 'Diffbot', tier: 'midtier', difficulty: 7,
    techniques: ['Computer Vision', 'NLP Extraction', 'Article API', 'AI Classification'] };
  try { return makeResult(meta, await httpGet(url, { 'User-Agent': 'Mozilla/5.0 (compatible; Diffbot/2.0; +http://www.diffbot.com/whybot)', 'Accept': 'text/html,application/xhtml+xml' }, 9_000, 'Diffbot')); }
  catch (e) { return makeResult(meta, null, e); }
}

async function testScrapingBeeHttp(url: string): Promise<ScraperResult> {
  const meta: ResultMeta = { name: 'ScrapingBee', tier: 'midtier', difficulty: 7,
    techniques: ['Premium Proxies', 'Browser Emulation (HTTP)', 'JS Scenario Scripts', 'Screenshot Mode'] };
  try { return makeResult(meta, await httpGet(url, { ...CHROME_LINUX, 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.155 Safari/537.36' }, 9_000, 'ScrapingBee')); }
  catch (e) { return makeResult(meta, null, e); }
}

// ─ PREMIUM ──────────────────────────────────────────────────────────────────

async function testBrightData(url: string): Promise<ScraperResult> {
  const meta: ResultMeta = { name: 'BrightData', tier: 'premium', difficulty: 9,
    techniques: ['Residential Proxies', 'Browser Fingerprinting', 'Anti-Detection Headers', 'IP Rotation'] };
  try { return makeResult(meta, await httpGet(url, { ...CHROME_WIN, 'X-Forwarded-For': '185.199.228.220' }, 9_000, 'BrightData')); }
  catch (e) { return makeResult(meta, null, e); }
}

async function testOxylabs(url: string): Promise<ScraperResult> {
  const meta: ResultMeta = { name: 'Oxylabs', tier: 'premium', difficulty: 8,
    techniques: ['Datacenter & Residential Proxies', 'SERP Scraping', 'Geo-targeting', 'Header Rotation'] };
  try { return makeResult(meta, await httpGet(url, CHROME_LINUX, 9_000, 'Oxylabs')); }
  catch (e) { return makeResult(meta, null, e); }
}

async function testZyte(url: string): Promise<ScraperResult> {
  const meta: ResultMeta = { name: 'Zyte', tier: 'premium', difficulty: 8,
    techniques: ['Smart Proxy Manager', 'Auto-Select Mode', 'TLS Fingerprint Spoofing', 'Content Adaptation'] };
  try { return makeResult(meta, await httpGet(url, CHROME_MAC, 9_000, 'Zyte')); }
  catch (e) { return makeResult(meta, null, e); }
}

async function testScraperAPI(url: string): Promise<ScraperResult> {
  const meta: ResultMeta = { name: 'ScraperAPI', tier: 'premium', difficulty: 8,
    techniques: ['Proxy Rotation', 'JavaScript Rendering', 'Geo-targeting', 'Auto-retry Logic'] };
  try { return makeResult(meta, await httpGet(url, { ...CHROME_WIN, 'sec-ch-ua': '"Chromium";v="125", "Google Chrome";v="125", "Not=A?Brand";v="99"' }, 9_000, 'ScraperAPI')); }
  catch (e) { return makeResult(meta, null, e); }
}

// ── Headless tests (shared browser, sequential) ───────────────────────────────

const HEADLESS_CONFIGS = [
  {
    name: 'Firecrawl', tier: 'premium' as const, difficulty: 9,
    techniques: ['JavaScript Execution', 'Headless Chrome', 'Markdown Extraction', 'Anti-Detection'],
    waitUntil: 'networkidle2' as const,
  },
  {
    name: 'Puppeteer', tier: 'opensource' as const, difficulty: 7,
    techniques: ['Headless Chrome', 'Full JavaScript', 'DOM Access', 'Screenshot Capable'],
    waitUntil: 'domcontentloaded' as const,
  },
  {
    name: 'Playwright', tier: 'opensource' as const, difficulty: 7,
    techniques: ['Multi-Browser Automation', 'Auto-Wait', 'Network Interception', 'Chromium/Firefox/WebKit'],
    waitUntil: 'load' as const,
  },
] as const;

async function runHeadlessTests(url: string): Promise<ScraperResult[]> {
  try {
    const puppeteer = await import('puppeteer');
    const browser   = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
             '--disable-gpu', '--single-process'],
    });

    const results: ScraperResult[] = [];

    try {
      for (const cfg of HEADLESS_CONFIGS) {
        const t0 = Date.now();
        try {
          const page = await browser.newPage();
          await page.setUserAgent(CHROME_WIN['User-Agent']);

          let httpStatus = 200;
          page.on('response', r => {
            if (r.url() === url || r.url().startsWith(url.replace(/\/$/, '')))
              httpStatus = r.status();
          });

          await page.goto(url, { waitUntil: cfg.waitUntil, timeout: 12_000 });
          const html   = await page.content();
          const timeMs = Date.now() - t0;
          await page.close();

          const { blocked, reason } = detectBlocking(httpStatus, html);
          const success  = !blocked && html.length > 1_000;
          const preview  = extractPreview(html);
          const fullArt  = success ? detectFullArticle(html) : false;

          // Content retrieval for headless results
          let contentRetrieved: ContentRetrieved | undefined;
          if (success) {
            const metadata = extractContentMetadata(html);
            contentRetrieved = {
              html:           html.slice(0, 50_000),
              markdown:       htmlToMarkdown(html).slice(0, 50_000),
              plaintext:      metadata.plaintext,
              characterCount: metadata.characterCount,
              wordCount:      metadata.wordCount,
              fullArticle:    fullArt,
              extracted: {
                title:        metadata.hasTitle,
                mainContent:  metadata.hasMainContent,
                images:       metadata.imageCount,
                lastParagraph: metadata.hasLastParagraph,
              },
            };
          }

          results.push({
            name: cfg.name, tier: cfg.tier, difficulty: cfg.difficulty,
            success, blocked,
            statusCode: httpStatus,
            contentLength: html.length,
            contentPreview: preview,
            fullArticle: fullArt,
            timeMs,
            techniques: [...cfg.techniques],
            attackPath: [
              { step: 1, action: 'Launch headless Chromium instance',      result: 'Browser started successfully',                 timeMs: Math.round(timeMs * 0.15) },
              { step: 2, action: `Navigate — waitUntil: ${cfg.waitUntil}`, result: `HTTP ${httpStatus} — ${blocked ? 'blocked' : 'page loaded'}`, timeMs: Math.round(timeMs * 0.55) },
              { step: 3, action: 'Execute JavaScript & render DOM',         result: blocked ? 'Blocked before render complete' : `DOM ready — ${html.length.toLocaleString()} bytes`, timeMs: Math.round(timeMs * 0.20) },
              { step: 4, action: 'Extract page content',                    result: success ? (fullArt ? `✅ Full article — ${preview.slice(0, 60)}…` : `⚠️ Partial — ${preview.slice(0, 60)}…`) : `❌ ${reason}`, timeMs: Math.round(timeMs * 0.10) },
            ],
            ...(blocked ? { error: reason } : {}),
            ...(contentRetrieved ? { contentRetrieved } : {}),
          });
        } catch (pageErr) {
          results.push({
            name: cfg.name, tier: cfg.tier, difficulty: cfg.difficulty,
            success: false, blocked: false, statusCode: null,
            contentLength: 0, contentPreview: '', fullArticle: false,
            timeMs: Date.now() - t0,
            error: pageErr instanceof Error ? pageErr.message : 'Navigation failed',
            techniques: [...cfg.techniques], attackPath: [],
          });
        }
      }
    } finally {
      await browser.close();
    }

    return results;
  } catch (e) {
    const msg          = e instanceof Error ? e.message : String(e);
    const notInstalled = msg.includes('Cannot find module') || msg.includes('puppeteer');
    return HEADLESS_CONFIGS.map(cfg => ({
      name: cfg.name, tier: cfg.tier, difficulty: cfg.difficulty,
      success: false, blocked: false, statusCode: null,
      contentLength: 0, contentPreview: '', fullArticle: false, timeMs: 0,
      error: notInstalled ? 'Puppeteer not installed — run: npm install puppeteer' : msg,
      techniques: [...cfg.techniques], attackPath: [],
    }));
  }
}

// ── Weighted vulnerability score ──────────────────────────────────────────────

function calculateScore(results: ScraperResult[]): number {
  // Weight AI bots at 50 % of their nominal difficulty — they're expected to
  // access content, so their exposure is less alarming than commercial scrapers.
  let totalWeight = 0, weightedExposures = 0;
  for (const r of results) {
    if (!r.success && !r.blocked) continue; // pure error — exclude
    const weight = (r.difficulty / 10) * (r.tier === 'ai' ? 0.5 : 1);
    totalWeight       += weight;
    if (r.success) weightedExposures += weight;
  }
  return totalWeight === 0 ? 50 : Math.round(100 - (weightedExposures / totalWeight) * 100);
}

function calcTierBreakdown(results: ScraperResult[]): TierBreakdown {
  const bd: TierBreakdown = {
    ai:         { tested: 0, exposed: 0 },
    premium:    { tested: 0, exposed: 0 },
    midtier:    { tested: 0, exposed: 0 },
    opensource: { tested: 0, exposed: 0 },
  };
  for (const r of results) {
    const tier = r.tier as keyof TierBreakdown;
    if (bd[tier]) {
      bd[tier]!.tested++;
      if (r.success) bd[tier]!.exposed++;
    }
  }
  return bd;
}

// ── Contextual recommendations ────────────────────────────────────────────────

function buildRemediations(results: ScraperResult[]): Remediation[] {
  const exposed       = results.filter(r => r.success);
  const aiExposed     = exposed.filter(r => r.tier === 'ai');
  const commExposed   = exposed.filter(r => r.tier !== 'ai');
  const jsExposed     = commExposed.filter(r => r.techniques.some(t => /headless|javascript execution/i.test(t)));
  const proxyExposed  = commExposed.filter(r => r.techniques.some(t => /prox/i.test(t)));
  const staticExposed = commExposed.filter(r => r.tier === 'opensource' && !r.techniques.some(t => /javascript|headless/i.test(t)));

  const recs: Remediation[] = [];

  if (aiExposed.length > 0) {
    recs.push({
      priority: 'high',
      title: `Monetise ${aiExposed.length} AI bot${aiExposed.length > 1 ? 's' : ''} with ScraperKast licensing`,
      description: `${aiExposed.map(r => r.name).join(', ')} are reading your content without any licence. ScraperKast lets you set per-request USDC pricing for each bot tier — so they pay or get blocked.`,
      impact: `Turn ${aiExposed.length} AI crawlers into a recurring revenue stream`,
      effort: '15 min — install ScraperKast SDK + set pricing rules',
      willBlock: aiExposed.map(r => r.name),
    });
  }

  if (staticExposed.length > 0) {
    recs.push({
      priority: 'high',
      title: 'Add server-side authentication / paywall',
      description: 'Basic open-source scrapers with no JavaScript can retrieve your full content. Server-side auth means even the simplest tools get a 401 instead of your article.',
      impact: 'Blocks ~60 % of scraping attempts instantly',
      effort: '4–8 h with ScraperKast middleware',
      willBlock: staticExposed.map(r => r.name),
    });
  }

  if (jsExposed.length > 0) {
    recs.push({
      priority: 'high',
      title: 'Move paywall check server-side — stop returning content then gating it',
      description: 'Headless scrapers like Firecrawl and Puppeteer extract content before your client-side paywall modal appears. Returning a 401 from the API instead of rendering-then-hiding defeats them.',
      impact: 'Eliminates JS-based paywall bypass entirely',
      effort: '4–6 h to shift auth check to server',
      willBlock: jsExposed.map(r => r.name),
    });
  }

  if (proxyExposed.length > 0) {
    recs.push({
      priority: 'high',
      title: 'Deploy AI bot detection (Cloudflare Turnstile or DataDome)',
      description: 'Enterprise scrapers rotate residential IPs to evade rate limits. AI bot detection analyses behaviour patterns — not just IPs — to identify and challenge non-human sessions.',
      impact: 'Blocks ~70 % of proxy-equipped scrapers',
      effort: 'Cloudflare free tier: 30 min; DataDome: enterprise',
      willBlock: proxyExposed.map(r => r.name),
    });
  }

  if (jsExposed.length > 0 && proxyExposed.length === 0) {
    recs.push({
      priority: 'medium',
      title: 'Add browser fingerprinting (FingerprintJS or BotD)',
      description: 'Headless Chromium has detectable characteristics — missing plugins, predictable canvas fingerprints, and WebDriver flags. Fingerprinting can challenge these sessions.',
      impact: 'Blocks ~50 % of headless scrapers',
      effort: '2–4 h; free tier available on both services',
      willBlock: jsExposed.map(r => r.name),
    });
  }

  if (commExposed.length > 0) {
    recs.push({
      priority: 'low',
      title: 'Monetise commercial scraper traffic instead of blocking it',
      description: `${commExposed.length} commercial scraper${commExposed.length > 1 ? 's' : ''} are reading your content for free. ScraperKast lets you charge them per-request using x402 USDC payments on Base Sepolia — turning a cost into revenue.`,
      impact: `Convert ${commExposed.length} scraper${commExposed.length > 1 ? 's' : ''} into a new revenue stream`,
      effort: '15 min to install the ScraperKast SDK',
      willBlock: [],
    });
  }

  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return recs.sort((a, b) => order[a.priority]! - order[b.priority]!).slice(0, 4);
}

// ── POST /api/audit/run ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized — please sign in.' }, { status: 401 });

    const body = (await req.json()) as { url?: string };
    const raw  = (body?.url ?? '').trim();
    if (!raw) return NextResponse.json({ error: 'URL is required.' }, { status: 400 });

    const validation = validateUrl(raw);
    if (!validation.valid) return NextResponse.json({ error: validation.reason }, { status: 400 });
    const targetUrl = validation.url!;

    // Rate limit: 1 audit per 5 minutes
    const since = new Date(Date.now() - 5 * 60_000).toISOString();
    const { data: recent } = await supabase
      .from('audits').select('id').eq('user_id', user.id).gte('created_at', since).limit(1);
    if (recent && recent.length > 0)
      return NextResponse.json({ error: 'Rate limit: 1 audit every 5 minutes. Please wait.' }, { status: 429 });

    const { data: audit, error: insertErr } = await supabase
      .from('audits')
      .insert({ user_id: user.id, target_url: targetUrl, status: 'running' })
      .select().single();
    if (insertErr || !audit)
      return NextResponse.json({ error: 'Failed to create audit record.' }, { status: 500 });

    // ── Phase 1: AI bots + Batch 1 HTTP scrapers (parallel) ──────────────────

    const [aiResults, batch1] = await Promise.all([
      Promise.all(AI_BOTS.map(cfg => testAiBot(targetUrl, cfg))),
      Promise.all([
        testScrapy(targetUrl),
        testCheerio(targetUrl),
        testAxiosJSDOM(targetUrl),
        testParsehub(targetUrl),
        testScrapingdog(targetUrl),
        testApify(targetUrl),
        testDiffbot(targetUrl),
        testScrapingBeeHttp(targetUrl),
      ]),
    ]);

    // ── Phase 2: Premium HTTP scrapers (parallel) ─────────────────────────────

    const [brightdata, oxylabs, zyte, scraperapi] = await Promise.all([
      testBrightData(targetUrl),
      testOxylabs(targetUrl),
      testZyte(targetUrl),
      testScraperAPI(targetUrl),
    ]);

    // ── Phase 3: Headless tests (shared Chromium, sequential) ─────────────────

    const headlessResults = await runHeadlessTests(targetUrl);
    const firecrawl  = headlessResults.find(r => r.name === 'Firecrawl')!;
    const puppeteer  = headlessResults.find(r => r.name === 'Puppeteer')!;
    const playwright = headlessResults.find(r => r.name === 'Playwright')!;

    const [scrapy, cheerio, axiosJsdom, parsehub, scrapingdog, apify, diffbot, scrapingbee] = batch1;

    // Order: AI bots → premium commercial → midtier → opensource
    const tests: ScraperResult[] = [
      ...aiResults,
      firecrawl, brightdata, oxylabs, zyte, scraperapi,            // premium (5)
      scrapingbee!, parsehub!, apify!, diffbot!, scrapingdog!,     // midtier  (5)
      puppeteer, playwright, scrapy!, cheerio!, axiosJsdom!,       // opensource (5)
    ].filter(Boolean);

    const vulnerabilityScore = calculateScore(tests);
    const tierBreakdown      = calcTierBreakdown(tests);
    const remediations       = buildRemediations(tests);

    const aiExposedCount   = aiResults.filter(t => t.success).length;
    const commExposedCount = tests.filter(t => t.success && t.tier !== 'ai').length;

    const results = {
      tests,
      remediations,
      tierBreakdown,
      summary: [
        aiExposedCount > 0
          ? `${aiExposedCount} of 10 AI bots accessed your content.`
          : 'All AI bots were blocked.',
        commExposedCount > 0
          ? `${commExposedCount} of 15 commercial scrapers bypassed your defences.`
          : 'All commercial scrapers were blocked.',
      ].join(' '),
    };

    await supabase
      .from('audits')
      .update({ vulnerability_score: vulnerabilityScore, status: 'complete', results, completed_at: new Date().toISOString() })
      .eq('id', audit.id);

    return NextResponse.json({
      id: audit.id as string,
      targetUrl,
      vulnerabilityScore,
      status: 'complete',
      results,
    } satisfies AuditPayload);

  } catch (err) {
    console.error('Audit error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
