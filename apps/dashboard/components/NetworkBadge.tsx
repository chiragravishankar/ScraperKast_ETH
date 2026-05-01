'use client';

type EthNetwork = 'base-sepolia' | 'sepolia' | 'mainnet';

interface NetworkBadgeProps {
  network?: EthNetwork;
}

const NETWORK_LABELS: Record<EthNetwork, string> = {
  'base-sepolia': 'Base Sepolia',
  sepolia:        'Sepolia',
  mainnet:        'Mainnet',
};

export default function NetworkBadge({
  network = (process.env.NEXT_PUBLIC_DEFAULT_NETWORK as EthNetwork | undefined) ?? 'base-sepolia',
}: NetworkBadgeProps) {
  const isMainnet = network === 'mainnet';
  return (
    <span className={`badge ${isMainnet ? 'badge-green' : 'badge-amber'}`}>
      <span className={`w-1.5 h-1.5 rounded-full animate-pulse-soft ${isMainnet ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {NETWORK_LABELS[network] ?? network}
    </span>
  );
}
