import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Production: create a Stripe Checkout Session and return the URL.
 * Demo: simulate the session creation and return a mock session ID.
 *
 * POST body: { amountUsd: number }
 */
export async function POST(req: NextRequest) {
  const { amountUsd } = await req.json() as { amountUsd?: number };

  if (!amountUsd || amountUsd < 1) {
    return NextResponse.json({ error: 'Minimum deposit is $1.00' }, { status: 400 });
  }

  // TODO (production):
  //   const session = await stripe.checkout.sessions.create({
  //     payment_method_types: ['card'],
  //     line_items: [{ price_data: { currency: 'usd', product_data: { name: 'ScraperKast USDC' },
  //       unit_amount: amountUsd * 100 }, quantity: 1 }],
  //     mode: 'payment',
  //     success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/wallet?deposit=success`,
  //     cancel_url:  `${process.env.NEXT_PUBLIC_BASE_URL}/dashboard/wallet`,
  //     metadata: { userId: currentUser.id, amountUsd },
  //   });
  //   return NextResponse.json({ sessionId: session.id, checkoutUrl: session.url });

  await new Promise(r => setTimeout(r, 600)); // simulate network

  const sessionId = `cs_test_${Math.random().toString(36).slice(2, 20)}`;
  return NextResponse.json({
    sessionId,
    // In production: checkoutUrl would redirect user to Stripe hosted page
    checkoutUrl: null,
    amountUsd,
    amountUsdc: amountUsd, // 1:1 peg
  });
}
