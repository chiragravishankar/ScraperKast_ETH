/**
 * Behavioral analysis for detecting disguised commercial scrapers.
 *
 * Tracks per-IP request history in memory to surface signals that
 * User-Agent matching alone cannot catch — high request rates, sequential
 * path access, and browser-fingerprint mismatches used by tools like
 * Firecrawl, BrightData, Oxylabs, and ScraperAPI.
 *
 * Memory is bounded to 1 000 IPs and self-cleaning (60-second sliding window).
 * Performance target: < 10 ms per call (typically < 1 ms).
 */

// ─── Public types ──────────────────────────────────────────────────────────────

/** Full request context needed for behavioral analysis. */
export interface RequestContext {
  /** Value of the User-Agent header (may be empty string). */
  userAgent: string;
  /** Client IP address — used as the tracking key. */
  ip: string;
  /** Raw request headers (case-insensitive values accepted). */
  headers: Record<string, string | string[] | undefined>;
  /** Request path, e.g. "/article/42". */
  path: string;
  /**
   * Unix timestamp in milliseconds.
   * Accepts historical values so tests can replay time without mocking.
   */
  timestamp: number;
}

/** Behavioral signals extracted from a single request in context of past history. */
export interface BehaviorSignals {
  /** Requests from this IP in the last 1 second (at request time). */
  requestsPerSecond: number;
  /** True when the IP has accessed 3+ pages with incrementing numeric suffixes. */
  sequentialPattern: boolean;
  /** Browser headers expected on every real browser request that are absent. */
  missingHeaders: string[];
  /** True when a Cookie header is present. */
  hasCookies: boolean;
  /** True when a Referer / Referrer header is present. */
  hasReferer: boolean;
  /**
   * True when request signals suggest JavaScript is (or was) running
   * (sec-fetch-* headers, or cookies + referer together).
   */
  javascriptEnabled: boolean;
  /**
   * True when the User-Agent claims a modern browser but contradictory header
   * evidence suggests a scraper (missing sec-ch-ua for Chrome 90+, missing
   * Accept-Language, or an exposed WebDriver header).
   */
  suspiciousFingerprint: boolean;
}

// ─── Module-level state ────────────────────────────────────────────────────────

/** IP → array of request timestamps (ms) within the last 60 seconds. */
const requestHistory = new Map<string, number[]>();

/** IP → ordered list of the last 10 paths visited. */
const pathHistory = new Map<string, string[]>();

// Start a background cleanup timer that prunes stale entries every 60 s.
// `unref()` prevents the timer from keeping the Node.js process alive when
// everything else has exited — safe in both production and test environments.
const _cleanupTimer = setInterval(cleanOldEntries, 60_000);
if (typeof (_cleanupTimer as NodeJS.Timeout).unref === 'function') {
  (_cleanupTimer as NodeJS.Timeout).unref();
}

/** Remove entries older than 60 seconds from request history. */
function cleanOldEntries(): void {
  const cutoff = Date.now() - 60_000;
  for (const [ip, timestamps] of requestHistory) {
    const fresh = timestamps.filter(t => t > cutoff);
    if (fresh.length === 0) requestHistory.delete(ip);
    else                    requestHistory.set(ip, fresh);
  }
}

/**
 * Wipe all tracked state.
 * Useful in tests to isolate each scenario and in long-running processes
 * that need an explicit hard reset.
 */
export function clearBehavioralHistory(): void {
  requestHistory.clear();
  pathHistory.clear();
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Safely retrieve a header value as a lowercase string. */
function hdr(headers: RequestContext['headers'], name: string): string {
  const val = headers[name.toLowerCase()];
  if (Array.isArray(val)) return (val[0] ?? '').toLowerCase();
  return (val ?? '').toLowerCase();
}

/** Record this request in the tracking maps. */
function updateHistory(ctx: RequestContext): void {
  // ── Request timestamps (last 60 seconds) ────────────────────────────────
  const cutoff     = ctx.timestamp - 60_000;
  const timestamps = (requestHistory.get(ctx.ip) ?? []).filter(t => t > cutoff);
  timestamps.push(ctx.timestamp);
  requestHistory.set(ctx.ip, timestamps);

  // ── Path history (last 10 paths) ─────────────────────────────────────────
  const paths = pathHistory.get(ctx.ip) ?? [];
  paths.push(ctx.path);
  if (paths.length > 10) paths.shift();
  pathHistory.set(ctx.ip, paths);

  // Safety valve: if we're tracking more than 1 000 IPs, prune now.
  if (requestHistory.size > 1_000) cleanOldEntries();
}

/** Count requests from `ip` within the 1-second window ending at `now`. */
function calculateRPS(ip: string, now: number): number {
  const oneSecAgo = now - 1_000;
  return (requestHistory.get(ip) ?? []).filter(t => t >= oneSecAgo).length;
}

/**
 * Extract the last numeric segment from a URL path.
 * "/page/42" → 42, "/article-7" → 7, "/blog" → null.
 */
function extractTrailingNumber(path: string): number | null {
  const m = /(\d+)(?:[/?#].*)?$/.exec(path);
  return m ? parseInt(m[1]!, 10) : null;
}

/**
 * Return true when the IP's recent path history shows 3+ incrementing pages
 * (e.g. /page/1 → /page/2 → /page/3 or /article-5 → /article-6 → /article-7).
 */
function detectSequentialAccess(ip: string): boolean {
  const paths = pathHistory.get(ip) ?? [];
  if (paths.length < 3) return false;

  let consecutiveRuns = 0;
  for (let i = 1; i < paths.length; i++) {
    const prev = extractTrailingNumber(paths[i - 1]!);
    const curr = extractTrailingNumber(paths[i]!);
    if (prev !== null && curr !== null && curr === prev + 1) {
      consecutiveRuns++;
    }
  }
  // Two consecutive increments = at least 3 sequential pages.
  return consecutiveRuns >= 2;
}

/** Headers that every real browser unconditionally sends. */
const REQUIRED_HEADERS = ['accept', 'accept-language', 'accept-encoding'] as const;

function findMissingHeaders(headers: RequestContext['headers']): string[] {
  return REQUIRED_HEADERS.filter(h => !hdr(headers, h));
}

function hasCookies(headers: RequestContext['headers']): boolean {
  return hdr(headers, 'cookie').length > 0;
}

function hasReferer(headers: RequestContext['headers']): boolean {
  return hdr(headers, 'referer').length > 0 || hdr(headers, 'referrer').length > 0;
}

/**
 * True when request headers suggest JavaScript is (or was) running.
 *
 * Signals used:
 *   - `sec-fetch-*` headers (Chrome/Edge, only set by the browser itself)
 *   - Cookies present AND a referer — both require previous page visits
 */
function checkJavaScriptSignals(headers: RequestContext['headers']): boolean {
  const secFetch = hdr(headers, 'sec-fetch-dest');
  if (secFetch.length > 0) return true;
  return hasCookies(headers) && hasReferer(headers);
}

/**
 * Return true when the User-Agent claims a modern browser but headers
 * contradict that claim — a common scraper tell.
 *
 * Checks:
 *  1. Chrome ≥ 90 without sec-ch-ua (Chromium has sent this since v90)
 *  2. Mozilla/5.0 UA without Accept-Language
 *  3. Explicit WebDriver / X-WebDriver header (Selenium / Puppeteer leak)
 *
 * @param headers    - Raw request headers.
 * @param contextUA  - Top-level `RequestContext.userAgent` field, used as
 *                     authoritative source when no `user-agent` header is present.
 */
function analyzeBrowserFingerprint(
  headers: RequestContext['headers'],
  contextUA = '',
): boolean {
  // Prefer the explicit user-agent header; fall back to the RequestContext field.
  const ua       = hdr(headers, 'user-agent') || contextUA.toLowerCase();
  const secChUa  = hdr(headers, 'sec-ch-ua');
  const acceptLang = hdr(headers, 'accept-language');

  // Chrome/Chromium 90+ always includes sec-ch-ua.
  const chromeMatch = /chrome\/(\d+)/.exec(ua);
  if (chromeMatch) {
    const version = parseInt(chromeMatch[1] ?? '0', 10);
    if (version >= 90 && !secChUa) return true;
  }

  // Any modern browser UA without Accept-Language is suspicious.
  if (/mozilla\/5\.0/i.test(ua) && !acceptLang) return true;

  // Selenium / unpatched headless browser leaks the WebDriver header.
  if (hdr(headers, 'webdriver') || hdr(headers, 'x-webdriver')) return true;

  return false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Analyse one request in the context of its IP's recent history.
 *
 * Side effect: updates the in-memory request + path history for this IP.
 *
 * @param context - Full request context.
 * @returns Behavioral signals for use with {@link calculateBotScore}.
 */
export function analyzeBehavior(context: RequestContext): BehaviorSignals {
  updateHistory(context);

  return {
    requestsPerSecond:     calculateRPS(context.ip, context.timestamp),
    sequentialPattern:     detectSequentialAccess(context.ip),
    missingHeaders:        findMissingHeaders(context.headers),
    hasCookies:            hasCookies(context.headers),
    hasReferer:            hasReferer(context.headers),
    javascriptEnabled:     checkJavaScriptSignals(context.headers),
    suspiciousFingerprint: analyzeBrowserFingerprint(context.headers, context.userAgent),
  };
}
