import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEMO_SMART_WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

/** Returns the smart wallet deposit address for this user. */
export async function GET() {
  return NextResponse.json({
    address: DEMO_SMART_WALLET,
    network: process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet',
    token:   'USDC',
    memo:    null, // some platforms require a memo — not needed here
  });
}
