import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BANK_FEE_BPS = 100; // 1%

/**
 * Production: convert USDC → USD via exchange, initiate Stripe payout to the
 * user's connected bank account.
 * Demo: simulate the payout.
 *
 * POST body: { amountMicroUsdc: number, bankAccountId: string }
 */
export async function POST(req: NextRequest) {
  const { amountMicroUsdc, bankAccountId } =
    await req.json() as { amountMicroUsdc?: number; bankAccountId?: string };

  if (!amountMicroUsdc || amountMicroUsdc < 10_000_000) {
    return NextResponse.json({ error: 'Minimum bank withdrawal is 10 USDC' }, { status: 400 });
  }
  if (!bankAccountId) {
    return NextResponse.json({ error: 'No bank account specified' }, { status: 400 });
  }

  const feeUsdc     = Math.ceil(amountMicroUsdc * BANK_FEE_BPS / 10_000);
  const netUsdc     = amountMicroUsdc - feeUsdc;

  // TODO (production):
  //   const payout = await stripe.payouts.create({
  //     amount: Math.floor(netUsdc / 1_000_000 * 100), currency: 'usd',
  //     destination: bankAccountId,
  //   });
  //   return NextResponse.json({ success: true, payoutId: payout.id, netUsdc, estimatedArrival: '1-3 business days' });

  await new Promise(r => setTimeout(r, 900));

  return NextResponse.json({
    success:           true,
    payoutId:          `po_test_${Math.random().toString(36).slice(2, 18)}`,
    feeUsdc,
    netUsdc,
    estimatedArrival:  '1-3 business days',
  });
}
