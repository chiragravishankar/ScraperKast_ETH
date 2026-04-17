import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const CHARS   = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function randomHash(len = 88): string {
  return Array.from({ length: len }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { amount?: number; destination?: string };
  const { amount, destination } = body;

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
  }
  if (amount < 1_000_000) {
    return NextResponse.json({ error: 'Minimum withdrawal is 1 USDC' }, { status: 400 });
  }
  if (!destination || !BASE58.test(destination)) {
    return NextResponse.json({ error: 'Invalid Solana wallet address' }, { status: 400 });
  }

  // Simulate on-chain confirmation delay (~1.5 s)
  await new Promise(r => setTimeout(r, 1_500));

  const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet') as 'devnet' | 'mainnet';

  return NextResponse.json({
    success:     true,
    txHash:      randomHash(),
    amount,
    destination,
    fee:         25_000, // ~$0.000025 Solana tx fee in µUSDC
    network,
    timestamp:   new Date().toISOString(),
  });
}
