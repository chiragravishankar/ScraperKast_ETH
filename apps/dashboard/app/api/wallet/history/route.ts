import { NextResponse } from 'next/server';
import { generateTransactions } from '@/lib/mockData';

export const dynamic = 'force-dynamic';

export async function GET() {
  const txs = generateTransactions(20);

  const history = [
    {
      id:        'w-1',
      type:      'withdrawal' as const,
      amount:    -250_000_000,
      status:    'confirmed' as const,
      timestamp: new Date(Date.now() - 2 * 3_600_000).toISOString(),
      txHash:    '5xKt9mPqR2fLJZsGwHvNbXcYdE7uA1V3iTKoP6hQmCn8sD4',
      network:   'devnet',
    },
    {
      id:        'd-1',
      type:      'deposit' as const,
      amount:    50_000_000,
      status:    'confirmed' as const,
      timestamp: new Date(Date.now() - 5 * 3_600_000).toISOString(),
      txHash:    '9aXm2kNpQ1hJYrBgFvWdTsLcZ8uE6o3RiOsPjbH5fCnVm7',
      network:   'devnet',
    },
    ...txs.slice(0, 8).map(tx => ({
      id:        tx.id,
      type:      'revenue' as const,
      amount:    tx.basePrice,
      status:    tx.status,
      timestamp: tx.timestamp.toISOString(),
      txHash:    tx.txHash,
      network:   tx.network,
    })),
  ];

  return NextResponse.json({ history });
}
