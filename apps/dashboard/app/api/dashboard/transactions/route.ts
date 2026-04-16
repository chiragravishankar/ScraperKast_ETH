import { NextResponse } from 'next/server';
import { generateTransactions } from '@/lib/mockData';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status'); // 'confirmed'|'pending'|'failed'|null
  const search = searchParams.get('search') ?? '';

  let txs = generateTransactions(50);

  if (status) txs = txs.filter(t => t.status === status);
  if (search) txs = txs.filter(t =>
    t.txHash.toLowerCase().includes(search.toLowerCase()) ||
    t.botId.toLowerCase().includes(search.toLowerCase())
  );

  return NextResponse.json({ transactions: txs, network: 'devnet' });
}
