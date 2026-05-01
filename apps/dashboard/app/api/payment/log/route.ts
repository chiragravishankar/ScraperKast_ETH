/**
 * POST /api/payment/log
 *
 * Server-to-server endpoint (no Supabase auth — validated by siteId).
 * Logs a verified bot payment, creates a WalletTransaction ledger entry,
 * and credits the site owner's platform balance.
 *
 * Body: { siteId, botId, botName?, userAgent?, method, amount, currency?,
 *         tokenIn?, amountIn?, network, txHash, verified?, blockNumber?, path }
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// ── POST /api/payment/log ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      siteId:       string;
      botId:        string;
      botName?:     string;
      userAgent?:   string;
      method:       string;
      amount:       number;
      currency?:    string;
      tokenIn?:     string;
      amountIn?:    number;
      network:      string;
      txHash:       string;
      verified?:    boolean;
      blockNumber?: number;
      path:         string;
    };

    // ── Required field validation ──────────────────────────────────────────────

    const missing = (['siteId', 'botId', 'method', 'amount', 'network', 'txHash', 'path'] as const)
      .filter(k => body[k] === undefined || body[k] === null || body[k] === '');

    if (missing.length) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 },
      );
    }

    if (body.amount <= 0) {
      return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 });
    }

    const validMethods = ['x402', 'uniswap', 'direct'];
    if (!validMethods.includes(body.method)) {
      return NextResponse.json(
        { error: `Invalid method "${body.method}". Valid: ${validMethods.join(', ')}` },
        { status: 400 },
      );
    }

    // ── Verify site exists and get owner userId ───────────────────────────────

    const site = await prisma.site.findUnique({
      where:  { id: body.siteId },
      select: { id: true, active: true, userId: true },
    });

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }
    if (!site.active) {
      return NextResponse.json({ error: 'Site is not active' }, { status: 403 });
    }

    // ── Atomic: log + ledger + credit balance ─────────────────────────────────

    const isVerified = body.verified ?? true;

    const result = await prisma.$transaction(async tx => {
      // a) Per-site payment record
      const transaction = await tx.transaction.create({
        data: {
          siteId:      body.siteId,
          botId:       body.botId,
          botName:     body.botName   ?? body.botId,
          userAgent:   body.userAgent ?? '',
          method:      body.method,
          amount:      body.amount,
          currency:    body.currency  ?? 'USDC',
          tokenIn:     body.tokenIn   ?? null,
          amountIn:    body.amountIn  ?? null,
          network:     body.network,
          txHash:      body.txHash,
          verified:    isVerified,
          blockNumber: body.blockNumber ?? null,
          path:        body.path,
        },
      });

      // b) Platform wallet ledger entry
      await tx.walletTransaction.create({
        data: {
          userId:   site.userId,
          type:     'revenue',
          amount:   body.amount,
          network:  body.network,
          txHash:   body.txHash,
          verified: isVerified,
          status:   isVerified ? 'confirmed' : 'pending',
          siteId:   body.siteId,
        },
      });

      // c) Credit owner balance only when verified
      if (isVerified) {
        await tx.user.update({
          where: { id: site.userId },
          data:  { balance: { increment: body.amount } },
        });
      }

      return transaction;
    });

    return NextResponse.json({ success: true, transaction: result }, { status: 201 });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === 'P2002') {
      return NextResponse.json({ error: 'Transaction already logged' }, { status: 409 });
    }
    console.error('[POST /api/payment/log]', err);
    return NextResponse.json({ error: 'Failed to log transaction' }, { status: 500 });
  }
}
