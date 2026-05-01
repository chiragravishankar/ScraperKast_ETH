import { NextRequest, NextResponse } from 'next/server';
import { x402Middleware } from '@/lib/middleware/x402';

export const dynamic = 'force-dynamic';

/**
 * GET /api/content/[slug]
 *
 * Example x402-protected content endpoint.
 *
 * The site to protect is identified by the `x-site-id` request header.
 * In production you would derive this from the subdomain or a lookup table.
 *
 * Bot flow:
 *  1. Bot hits this endpoint without X-Payment-Proof → receives 402 with payment terms
 *  2. Bot pays on Base Sepolia, retries with X-Payment-Proof: <txHash>
 *  3. Middleware verifies payment on-chain → content is served
 *
 * Human/non-bot requests → served immediately (no payment required).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  // ── Resolve site ID ──────────────────────────────────────────────────────────
  //
  // Priority:
  //   1. x-site-id request header   (integration testing, multi-tenant setups)
  //   2. DEFAULT_SITE_ID env var     (single-site deployments)
  //
  const siteId =
    request.headers.get('x-site-id') ??
    process.env.DEFAULT_SITE_ID      ??
    '';

  if (!siteId) {
    return NextResponse.json(
      { error: 'No site configured. Set x-site-id header or DEFAULT_SITE_ID env var.' },
      { status: 500 },
    );
  }

  // ── Run x402 payment check ───────────────────────────────────────────────────
  const paymentResponse = await x402Middleware(request, { siteId });
  if (paymentResponse) return paymentResponse; // 402 / 403 / 404

  // ── Serve content ────────────────────────────────────────────────────────────
  //
  // Replace this with your real content fetching logic (DB, CMS, file, etc.)

  const content: Record<string, { title: string; body: string }> = {
    'test-article': {
      title: 'Test Article',
      body:  'This is premium content that was unlocked after a verified x402 payment.',
    },
    'ai-2026': {
      title: 'The State of AI in 2026',
      body:  'AI agents are now paying autonomously for data access via the x402 protocol.',
    },
  };

  const article = content[params.slug] ?? {
    title: params.slug,
    body:  `Content for "${params.slug}" — replace with real data in production.`,
  };

  return NextResponse.json({
    slug:       params.slug,
    title:      article.title,
    content:    article.body,
    paid:       true,
    network:    request.headers.get('x-payment-proof') ? 'base-sepolia' : null,
    timestamp:  new Date().toISOString(),
  });
}
