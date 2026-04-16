import { formatUsdcDollar, shortenHash, timeAgo, explorerUrl } from '@/lib/formatters';
import CopyButton from '@/components/CopyButton';
import type { Transaction } from '@/lib/mockData';
import { ExternalLink } from 'lucide-react';

const STATUS_STYLES: Record<Transaction['status'], string> = {
  confirmed: 'bg-emerald-100 text-emerald-700',
  pending:   'bg-amber-100 text-amber-700',
  failed:    'bg-red-100 text-red-600',
};

async function getTransactions(): Promise<Transaction[]> {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3001';
  const res  = await fetch(`${base}/api/dashboard/transactions`, { cache: 'no-store' });
  const data = await res.json() as { transactions: Transaction[] };
  return data.transactions;
}

export default async function TransactionsPage() {
  const transactions = await getTransactions();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Transactions</h1>
        <p className="text-sm text-slate-500 mt-0.5">On-chain USDC payment records from Solana</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Tx Hash</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Bot</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide text-right">Platform Fee</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Time</th>
                <th className="px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-700">{shortenHash(tx.txHash)}</span>
                      <CopyButton text={tx.txHash} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-slate-800">{tx.botName}</div>
                    <div className="text-xs text-slate-400 font-mono">{tx.botId}</div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-brand-dark font-mono">
                    {formatUsdcDollar(tx.basePrice)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-slate-500 font-mono text-xs">
                    {formatUsdcDollar(tx.platformFee)}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[tx.status]}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-400 text-xs">
                    {timeAgo(new Date(tx.timestamp))}
                  </td>
                  <td className="px-4 py-3.5">
                    <a
                      href={explorerUrl(tx.txHash, tx.network)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-brand-dark transition-colors"
                      title="View on Solana Explorer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
