import { formatUsdcDollar, shortenHash, timeAgo, explorerUrl } from '@/lib/formatters';
import CopyButton from '@/components/CopyButton';
import type { Transaction } from '@/lib/mockData';
import { ExternalLink, Wallet, CreditCard } from 'lucide-react';

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

function PaymentMethodBadge({ method, sessionId }: { method: Transaction['paymentMethod']; sessionId?: string }) {
  if (method === 'dodo') {
    return (
      <div className="flex items-center gap-1">
        <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
          <CreditCard className="w-3 h-3" />
          Card
        </span>
        {sessionId && (
          <span className="font-mono text-[10px] text-ink-3 truncate max-w-[80px]" title={sessionId}>
            {sessionId.slice(0, 10)}…
          </span>
        )}
      </div>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">
      <Wallet className="w-3 h-3" />
      Solana
    </span>
  );
}

export default async function TransactionsPage() {
  const transactions = await getTransactions();

  const solanaCount = transactions.filter((t) => t.paymentMethod === 'solana').length;
  const dodoCount   = transactions.filter((t) => t.paymentMethod === 'dodo').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-ink">Transactions</h1>
        <p className="text-sm text-ink-2 mt-0.5">On-chain USDC payment records from Solana</p>
      </div>

      {/* Payment method summary */}
      <div className="flex gap-3">
        <div className="flex items-center gap-2 bg-white border border-edge rounded-lg px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700">
            <Wallet className="w-3 h-3" /> Solana
          </span>
          <span className="font-semibold text-ink">{solanaCount}</span>
          <span className="text-ink-3">direct</span>
        </div>
        <div className="flex items-center gap-2 bg-white border border-edge rounded-lg px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
            <CreditCard className="w-3 h-3" /> Dodo
          </span>
          <span className="font-semibold text-ink">{dodoCount}</span>
          <span className="text-ink-3">credit card</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge-2 text-left">
                <th className="px-4 py-3 font-medium text-ink-2 text-xs uppercase tracking-wide">Tx Hash</th>
                <th className="px-4 py-3 font-medium text-ink-2 text-xs uppercase tracking-wide">Bot</th>
                <th className="px-4 py-3 font-medium text-ink-2 text-xs uppercase tracking-wide">Method</th>
                <th className="px-4 py-3 font-medium text-ink-2 text-xs uppercase tracking-wide text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-ink-2 text-xs uppercase tracking-wide text-right">Platform Fee</th>
                <th className="px-4 py-3 font-medium text-ink-2 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 font-medium text-ink-2 text-xs uppercase tracking-wide">Time</th>
                <th className="px-4 py-3 font-medium text-ink-2 text-xs uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-canvas transition-colors">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-ink">{shortenHash(tx.txHash)}</span>
                      <CopyButton text={tx.txHash} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="font-medium text-slate-800">{tx.botName}</div>
                    <div className="text-xs text-ink-3 font-mono">{tx.botId}</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <PaymentMethodBadge method={tx.paymentMethod} sessionId={tx.dodoSessionId} />
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold text-brand-dark font-mono">
                    {formatUsdcDollar(tx.basePrice)}
                  </td>
                  <td className="px-4 py-3.5 text-right text-ink-2 font-mono text-xs">
                    {formatUsdcDollar(tx.platformFee)}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[tx.status]}`}>
                      {tx.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-ink-3 text-xs">
                    {timeAgo(new Date(tx.timestamp))}
                  </td>
                  <td className="px-4 py-3.5">
                    <a
                      href={explorerUrl(tx.txHash, tx.network)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ink-3 hover:text-brand-dark transition-colors"
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
