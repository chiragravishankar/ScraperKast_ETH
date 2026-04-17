'use client';

interface NetworkBadgeProps {
  network?: 'devnet' | 'mainnet';
}

export default function NetworkBadge({
  network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet' | undefined) ?? 'devnet',
}: NetworkBadgeProps) {
  const isMainnet = network === 'mainnet';
  return (
    <span className={`badge ${isMainnet ? 'badge-green' : 'badge-amber'}`}>
      <span className={`w-1.5 h-1.5 rounded-full animate-pulse-soft ${isMainnet ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {isMainnet ? 'Mainnet' : 'Devnet'}
    </span>
  );
}
