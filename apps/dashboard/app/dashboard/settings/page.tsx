import NetworkBadge from '@/components/NetworkBadge';
import CopyButton from '@/components/CopyButton';

const MOCK_OWNER_WALLET  = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const MOCK_PLATFORM_WALLET = 'HN7cABqLq46Es1jh92dQQisAq662SmxELLLsHHe4YWrH';
const MOCK_API_KEY       = 'sk_live_scraperkast_abc123xyz456def789';
const MOCK_DOMAIN        = 'example.com';

function SettingRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-600 font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-sm text-slate-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-0.5">Wallet addresses, API keys, and network configuration</p>
      </div>

      {/* Network */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Network</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Active network</span>
          <NetworkBadge />
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Set <code className="font-mono bg-slate-100 px-1 rounded">SOLANA_NETWORK=mainnet</code> in your environment to switch to mainnet.
        </p>
      </div>

      {/* Wallets */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Wallet Addresses</h2>
        <SettingRow label="Owner Wallet"    value={MOCK_OWNER_WALLET}    mono />
        <SettingRow label="Platform Wallet" value={MOCK_PLATFORM_WALLET} mono />
      </div>

      {/* API Key */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">API Configuration</h2>
        <SettingRow label="Domain"  value={MOCK_DOMAIN} />
        <SettingRow label="API Key" value={MOCK_API_KEY} mono />
        <p className="text-xs text-slate-400 mt-3">
          Set this key as <code className="font-mono bg-slate-100 px-1 rounded">SCRAPERKAST_API_KEY</code> in your middleware environment.
        </p>
      </div>

      {/* Revenue split info */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Revenue Split</h2>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Website owner</span>
            <span className="font-semibold text-brand-dark">95%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className="bg-brand-dark h-2 rounded-full" style={{ width: '95%' }} />
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">ScraperKast platform</span>
            <span className="font-semibold text-slate-500">5%</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          The split is enforced on-chain by the ScraperKast Anchor program — no trust required.
        </p>
      </div>

      {/* Middleware config snippet */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Middleware Setup</h2>
        <pre className="bg-slate-950 text-slate-100 text-xs rounded-lg p-4 overflow-x-auto">
{`import { scraperKast } from '@scraperkast/middleware-express';

app.use(scraperKast({
  ownerWallet:    '${MOCK_OWNER_WALLET}',
  platformWallet: '${MOCK_PLATFORM_WALLET}',
  pricingRules: [
    { tier: 'free', maxRequests: 10_000 },
    { tier: 'paid', pricePerRequest: 500 }, // 0.0005 USDC
  ],
}));`}
        </pre>
      </div>
    </div>
  );
}
