/**
 * Diagnostic endpoint — tests raw HTTP reachability of a URL using three
 * different approaches so you can pinpoint exactly where requests fail.
 *
 * POST /api/test-scraper
 * Body: { "url": "https://techcrunch.com" }
 *
 * Usage from browser console (paste while on your dashboard):
 *   fetch('/api/test-scraper', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ url: 'https://techcrunch.com' })
 *   }).then(r => r.json()).then(console.log)
 *
 * Or with curl:
 *   curl -X POST https://<your-app>.vercel.app/api/test-scraper \
 *     -H 'Content-Type: application/json' \
 *     -d '{"url":"https://techcrunch.com"}'
 */

import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export const dynamic = 'force-dynamic';

// ── How to read the results ────────────────────────────────────────────────────
//
// SCENARIO A — requests succeed but with 403:
//   status: 403, timeMs: 50–500ms
//   → Cloudflare/WAF is blocking Vercel's datacenter IP.
//   → Requests ARE reaching the CDN but are rejected before hitting the origin.
//   → This is an IP-reputation issue, not a code bug.
//
// SCENARIO B — requests succeed with 200, timeMs < 500ms:
//   status: 200, contentLength: 5000–20000, preview contains JS challenge text
//   → Cloudflare is returning a JS challenge page (not real content).
//   → The site thinks we're a bot (correct) and is serving a challenge.
//
// SCENARIO C — requests succeed with 200, timeMs: 2000–8000ms, large body:
//   status: 200, contentLength: 50000+, real article text in preview
//   → The scraper simulation IS working. The audit blocking detection may be
//   → misclassifying successful scrapes. File a bug with the full preview.
//
// SCENARIO D — ENOTFOUND / ECONNREFUSED / ETIMEDOUT:
//   success: false, code: "ENOTFOUND" | "ECONNREFUSED" | "ETIMEDOUT"
//   → DNS failure or network-level block. Check Vercel outbound networking.
//   → Try the native fetch test — if that also fails, it's Vercel-level.
//
// SCENARIO E — all three fail but native fetch succeeds:
//   → axios configuration issue (unlikely but useful to rule out).

// ── Helpers ───────────────────────────────────────────────────────────────────

interface TestResult {
  test:          string;
  success:       boolean;
  timeMs?:       number;
  status?:       number;
  contentLength?: number;
  /** First 300 chars of body — enough to see if it's real content or a challenge. */
  preview?:      string;
  error?:        string;
  /** Node.js error code (ENOTFOUND, ETIMEDOUT, ECONNABORTED, etc.) */
  errorCode?:    string;
  /** Raw response headers — reveals Cloudflare/Akamai/etc. */
  headers?:      Record<string, string>;
}

function safePreview(data: unknown): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return str.replace(/\s+/g, ' ').slice(0, 300);
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let url: string;
  try {
    const body = await req.json() as { url?: unknown };
    url = typeof body.url === 'string' ? body.url.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }

  // Normalise
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;

  const results: TestResult[] = [];

  // ── Test 1: Plain axios (minimal headers — bot-like) ──────────────────────
  console.log(`[test-scraper] Test 1: plain axios → ${url}`);
  {
    const t0 = Date.now();
    try {
      const res = await axios.get<string>(url, {
        timeout: 12_000,
        responseType: 'text',
        validateStatus: () => true,
        maxRedirects: 5,
      });
      const timeMs = Date.now() - t0;
      const body   = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      console.log(`[test-scraper] ✓ plain axios  status=${res.status}  bytes=${body.length}  time=${timeMs}ms`);
      results.push({
        test: 'Plain axios (no User-Agent)',
        success: true,
        timeMs,
        status:         res.status,
        contentLength:  body.length,
        preview:        safePreview(body),
        headers:        Object.fromEntries(
          Object.entries(res.headers as Record<string, unknown>)
            .filter(([, v]) => typeof v === 'string')
            .map(([k, v]) => [k, String(v)])
        ),
      });
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      console.error(`[test-scraper] ✗ plain axios  code=${e.code}  msg=${e.message}`);
      results.push({
        test: 'Plain axios (no User-Agent)',
        success:   false,
        timeMs:    Date.now() - t0,
        error:     e.message,
        errorCode: e.code,
      });
    }
  }

  // ── Test 2: axios with full Chrome headers ────────────────────────────────
  console.log(`[test-scraper] Test 2: axios + Chrome headers → ${url}`);
  {
    const t0 = Date.now();
    try {
      const res = await axios.get<string>(url, {
        timeout: 12_000,
        responseType: 'text',
        validateStatus: () => true,
        maxRedirects: 5,
        headers: {
          'User-Agent':                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept':                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language':           'en-US,en;q=0.9',
          'Accept-Encoding':           'gzip, deflate, br',
          'sec-ch-ua':                 '"Google Chrome";v="125", "Chromium";v="125", "Not.A/Brand";v="24"',
          'sec-ch-ua-mobile':          '?0',
          'sec-ch-ua-platform':        '"Windows"',
          'Sec-Fetch-Dest':            'document',
          'Sec-Fetch-Mode':            'navigate',
          'Sec-Fetch-Site':            'none',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control':             'no-cache',
        },
      });
      const timeMs = Date.now() - t0;
      const body   = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      console.log(`[test-scraper] ✓ Chrome headers  status=${res.status}  bytes=${body.length}  time=${timeMs}ms`);
      results.push({
        test: 'axios + full Chrome headers',
        success: true,
        timeMs,
        status:        res.status,
        contentLength: body.length,
        preview:       safePreview(body),
        headers:       Object.fromEntries(
          Object.entries(res.headers as Record<string, unknown>)
            .filter(([, v]) => typeof v === 'string')
            .map(([k, v]) => [k, String(v)])
        ),
      });
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      console.error(`[test-scraper] ✗ Chrome headers  code=${e.code}  msg=${e.message}`);
      results.push({
        test: 'axios + full Chrome headers',
        success:   false,
        timeMs:    Date.now() - t0,
        error:     e.message,
        errorCode: e.code,
      });
    }
  }

  // ── Test 3: native fetch (Node.js built-in, bypasses axios entirely) ──────
  console.log(`[test-scraper] Test 3: native fetch → ${url}`);
  {
    const t0 = Date.now();
    try {
      const res  = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ScraperKastDiag/1.0)' },
        signal: AbortSignal.timeout(12_000),
      });
      const text   = await res.text();
      const timeMs = Date.now() - t0;
      console.log(`[test-scraper] ✓ native fetch  status=${res.status}  bytes=${text.length}  time=${timeMs}ms`);
      results.push({
        test: 'Native fetch (Node built-in)',
        success: true,
        timeMs,
        status:        res.status,
        contentLength: text.length,
        preview:       safePreview(text),
        headers:       Object.fromEntries(res.headers.entries()),
      });
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException;
      console.error(`[test-scraper] ✗ native fetch  code=${e.code ?? 'n/a'}  msg=${e.message}`);
      results.push({
        test: 'Native fetch (Node built-in)',
        success:   false,
        timeMs:    Date.now() - t0,
        error:     e.message,
        errorCode: e.code,
      });
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const anySuccess = results.some(r => r.success);
  const allFast    = results.every(r => (r.timeMs ?? 999) < 500);

  let diagnosis = '';
  if (!anySuccess) {
    const code = results[0]?.errorCode ?? 'unknown';
    if (/ENOTFOUND|ECONNREFUSED/.test(code))
      diagnosis = 'DNS / connection failure — Vercel cannot resolve or reach the host.';
    else if (/ETIMEDOUT|ECONNABORTED/.test(code))
      diagnosis = 'Timeout — the server is reachable but not responding within 12 s.';
    else
      diagnosis = `All requests failed (code: ${code}). Check Vercel outbound networking settings.`;
  } else if (allFast && results.some(r => r.status === 403)) {
    diagnosis =
      'Fast 403s confirm Cloudflare/WAF is blocking Vercel datacenter IPs before reaching the origin. ' +
      'This is IP-reputation blocking — not a code bug. ' +
      'To test accurately, the audit needs residential proxy IPs.';
  } else if (results.some(r => r.status === 200 && (r.contentLength ?? 0) < 20_000)) {
    diagnosis =
      'Got 200 responses but body is small — likely a JS challenge page (Cloudflare interstitial). ' +
      'Check the preview field for "just a moment" or "_cf_chl" text.';
  } else if (results.some(r => r.success && (r.timeMs ?? 0) > 1_000)) {
    diagnosis =
      'Requests succeeded with realistic timing. If the audit shows blocked, check the body ' +
      'preview — the blocking detection may be flagging valid content.';
  }

  console.log(`[test-scraper] diagnosis: ${diagnosis}`);

  return NextResponse.json({
    url,
    testedAt: new Date().toISOString(),
    diagnosis,
    results,
  });
}
