import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet') as 'devnet' | 'mainnet';

  // Mock data — in production, query SolanaConnection + on-chain program state.
  return NextResponse.json({
    balance:  1_245_670_000,   // µUSDC  → $1,245.67
    pending:  89_230_000,      // µUSDC  → $89.23
    lifetime: 5_432_100_000,   // µUSDC  → $5,432.10
    today:    12_500_000,      // µUSDC  → $12.50
    network,
  });
}
