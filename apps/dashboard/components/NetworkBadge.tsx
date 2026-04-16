'use client';

interface NetworkBadgeProps {
  network?: 'devnet' | 'mainnet';
}

export default function NetworkBadge({ network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet' | undefined) ?? 'devnet' }: NetworkBadgeProps) {
  const isMainnet = network === 'mainnet';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isMainnet
          ? 'bg-green-100 text-green-700 border border-green-200'
          : 'bg-amber-100 text-amber-700 border border-amber-200'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full animate-pulse-soft ${isMainnet ? 'bg-green-500' : 'bg-amber-500'}`}
      />
      {isMainnet ? 'Mainnet' : 'Devnet'}
    </span>
  );
}
