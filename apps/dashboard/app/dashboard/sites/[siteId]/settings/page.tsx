'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Globe, Bell, Trash2, AlertTriangle, ChevronRight,
  Mail, Webhook, Copy, Check, RefreshCw, ShieldOff,
  Wallet, Network, DollarSign, Zap, Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type SubTab = 'general' | 'payment' | 'domain' | 'notifications' | 'danger';

interface SiteSettings {
  id:            string;
  name:          string;
  url:           string;
  walletAddress: string | null;
  network:       string;
  defaultPrice:  number;
  enableX402:    boolean;
  enableUniswap: boolean;
  verified:      boolean;
  active:        boolean;
  user?:         { smartWalletAddress: string | null } | null;
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-1.5 text-2xs font-semibold text-ink-3 hover:text-ink px-2.5 py-1.5 rounded-lg hover:bg-edge-2 transition-colors"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function ToggleSwitch({ enabled, onChange, disabled = false }: {
  enabled:   boolean;
  onChange:  (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      className={cn(
        'relative rounded-full transition-colors duration-200 shrink-0',
        enabled ? 'bg-accent' : 'bg-edge',
        disabled && 'opacity-50 cursor-not-allowed',
      )}
      style={{ height: '22px', width: '40px' }}
      disabled={disabled}
    >
      <span
        className={cn(
          'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
          enabled ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function SavedBadge({ saved }: { saved: boolean }) {
  return saved ? (
    <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
      <Check className="w-3.5 h-3.5" /> Saved!
    </span>
  ) : null;
}

// ── General sub-tab ───────────────────────────────────────────────────────────

function GeneralTab({ siteId }: { siteId: string }) {
  const [siteName, setSiteName] = useState('');
  const [siteUrl,  setSiteUrl]  = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    fetch(`/api/sites/${siteId}/settings`)
      .then(r => r.ok ? r.json() as Promise<{ site: SiteSettings }> : null)
      .then(data => {
        if (data?.site) {
          setSiteName(data.site.name);
          setSiteUrl(data.site.url);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [siteId]);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch(`/api/sites/${siteId}/settings`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: siteName }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-5">
        <h3 className="text-sm font-bold text-ink">Site Details</h3>

        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5">Display name</label>
          {loading ? (
            <div className="h-10 bg-edge rounded-xl animate-pulse max-w-sm" />
          ) : (
            <input
              type="text"
              value={siteName}
              onChange={e => setSiteName(e.target.value)}
              className="input max-w-sm"
              placeholder="My awesome blog"
            />
          )}
          <p className="text-2xs text-ink-3 mt-1">Shown in the dashboard only.</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5">Site URL</label>
          <div className="relative max-w-sm">
            <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
            <input
              type="url"
              value={siteUrl}
              onChange={e => setSiteUrl(e.target.value)}
              className="input pl-10 max-w-sm"
              placeholder="https://yoursite.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5">Timezone</label>
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            className="text-sm border border-edge rounded-xl px-3 py-2.5 bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-accent/30 max-w-sm w-full"
          >
            <option value="America/New_York">America / New York (ET)</option>
            <option value="America/Los_Angeles">America / Los Angeles (PT)</option>
            <option value="Europe/London">Europe / London (GMT)</option>
            <option value="Europe/Berlin">Europe / Berlin (CET)</option>
            <option value="Asia/Tokyo">Asia / Tokyo (JST)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={() => { void handleSave(); }}
            disabled={saving || loading}
            className="flex items-center gap-2 bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {saving
              ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              : <ChevronRight className="w-4 h-4" />}
            Save Changes
          </button>
          <SavedBadge saved={saved} />
        </div>
      </div>

      {/* API key */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-ink">API Key</h3>
        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5">Site API key</label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-canvas border border-edge rounded-xl px-3 py-2.5 flex-1 max-w-sm">
              <code className="flex-1 text-xs font-mono text-ink-2 tracking-wider">
                sk_live_••••••••••••••••{siteId.slice(-4)}
              </code>
              <CopyBtn text={`sk_live_demo_${siteId}`} />
            </div>
            <button className="flex items-center gap-1.5 text-xs font-semibold border border-edge rounded-xl px-3 py-2.5 text-ink-2 hover:bg-canvas transition-colors">
              <RefreshCw className="w-3.5 h-3.5" />
              Rotate
            </button>
          </div>
          <p className="text-2xs text-ink-3 mt-1.5">
            Keep this secret. Rotating breaks existing integrations.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Payment sub-tab ───────────────────────────────────────────────────────────

function PaymentTab({ siteId }: { siteId: string }) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState('');

  const fetchSettings = useCallback(() => {
    setLoading(true);
    fetch(`/api/sites/${siteId}/settings`)
      .then(r => r.ok ? r.json() as Promise<{ site: SiteSettings }> : null)
      .then(data => {
        setSettings(data?.site ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [siteId]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/sites/${siteId}/settings`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultPrice:  settings.defaultPrice,
          enableX402:    settings.enableX402,
          enableUniswap: settings.enableUniswap,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setError(data.error ?? 'Failed to save');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Network error — try again');
    } finally {
      setSaving(false);
    }
  }

  function patch(updates: Partial<SiteSettings>) {
    setSettings(prev => prev ? { ...prev, ...updates } : prev);
  }

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1,2,3].map(i => <div key={i} className="card h-32 bg-canvas" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Smart wallet (auto-generated, read-only) */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-ink">Smart Wallet</h3>
          <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            Auto-generated
          </span>
        </div>
        <p className="text-xs text-ink-3">
          Bots pay directly to your smart wallet. No setup required — it was created automatically
          when you signed up.
        </p>

        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5">
            Your Smart Wallet Address
          </label>
          <div className="read-only-field">
            <input
              type="text"
              value={settings?.user?.smartWalletAddress ?? 'Generating…'}
              readOnly
              className="input font-mono max-w-lg bg-canvas cursor-default select-all"
            />
            <CopyBtn text={settings?.user?.smartWalletAddress ?? ''} />
          </div>
          <p className="text-2xs text-ink-3 mt-1.5">
            ✅ Auto-generated · read-only · bots pay here automatically.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5 flex items-center gap-1.5">
            <Network className="w-3.5 h-3.5" />
            Network
          </label>
          <input
            type="text"
            value="Base Sepolia Testnet"
            readOnly
            className="input max-w-sm bg-canvas cursor-default"
          />
          <p className="text-2xs text-ink-3 mt-1">
            All hackathon payments run on Base Sepolia (free faucet, fast confirmations).
          </p>
        </div>

        {/* How it works */}
        <div className="info-box">
          <strong>💡 How it works</strong>
          <ul>
            <li>Bots send USDC to your smart wallet address above</li>
            <li>Your balance updates automatically in the{' '}
              <a href="/dashboard/wallet">Wallet</a> page
            </li>
            <li>Withdraw anytime to your personal Ethereum address</li>
          </ul>
        </div>
      </div>

      {/* Pricing */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-ink">Default Pricing</h3>
        </div>
        <p className="text-xs text-ink-3">
          Applied to bots that don&apos;t have a specific rule set in the Protection tab.
        </p>

        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5">
            Price per request (USDC)
          </label>
          <div className="relative max-w-[180px]">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 text-sm font-medium pointer-events-none">$</span>
            <input
              type="number"
              step="0.001"
              min="0"
              max="1000"
              value={settings?.defaultPrice ?? 0.001}
              onChange={e => patch({ defaultPrice: parseFloat(e.target.value) || 0 })}
              className="input pl-7"
            />
          </div>
          <p className="text-2xs text-ink-3 mt-1">
            Default: $0.001 USDC per request. Override per-bot in Protection → Bot Rules.
          </p>
        </div>
      </div>

      {/* Payment methods */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-ink">Payment Methods</h3>
        </div>

        <div className="space-y-0">
          {/* x402 */}
          <div className="flex items-start gap-4 py-3.5 border-b border-edge">
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">KeeperHub x402</p>
              <p className="text-xs text-ink-3 mt-0.5">
                Returns HTTP 402 so AI agents pay autonomously without human intervention.
                The gold standard for autonomous agent payments.
              </p>
            </div>
            <ToggleSwitch
              enabled={settings?.enableX402 ?? true}
              onChange={v => patch({ enableX402: v })}
            />
          </div>

          {/* Uniswap */}
          <div className="flex items-start gap-4 py-3.5">
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink">Uniswap (Accept Any Token)</p>
              <p className="text-xs text-ink-3 mt-0.5">
                Bots can pay with ETH or any ERC-20 token — auto-swapped to USDC on arrival.
                Broader bot compatibility.
              </p>
            </div>
            <ToggleSwitch
              enabled={settings?.enableUniswap ?? true}
              onChange={v => patch({ enableUniswap: v })}
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 border-red-200 bg-red-50/40">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { void handleSave(); }}
          disabled={saving || loading}
          className="flex items-center gap-2 bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-50"
        >
          {saving
            ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            : <Save className="w-4 h-4" />}
          Save Payment Settings
        </button>
        <SavedBadge saved={saved} />
      </div>
    </div>
  );
}

// ── Domain sub-tab ────────────────────────────────────────────────────────────

function DomainTab({ siteId }: { siteId: string }) {
  const [verifying, setVerifying] = useState(false);
  const [verified,  setVerified]  = useState(siteId !== 'site_newsletter');

  function handleVerify() {
    setVerifying(true);
    setTimeout(() => { setVerifying(false); setVerified(true); }, 1800);
  }

  const TXT_RECORD = `scraperkast-verify=sk_verify_${siteId}_demo123`;

  return (
    <div className="space-y-6">
      <div className={cn(
        'card p-5 flex items-start gap-4',
        verified ? 'border-emerald-200 bg-emerald-50/50' : 'border-amber-200 bg-amber-50/50',
      )}>
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
          verified ? 'bg-emerald-100' : 'bg-amber-100',
        )}>
          {verified
            ? <Check className="w-4 h-4 text-emerald-600" />
            : <AlertTriangle className="w-4 h-4 text-amber-600" />}
        </div>
        <div>
          <p className={cn('text-sm font-bold', verified ? 'text-emerald-700' : 'text-amber-700')}>
            {verified ? 'Domain verified' : 'Domain not verified'}
          </p>
          <p className={cn('text-xs mt-0.5', verified ? 'text-emerald-600' : 'text-amber-600')}>
            {verified
              ? 'Your domain ownership is confirmed. Bot protection is active.'
              : 'Add the DNS TXT record below and click "Verify" to activate protection.'}
          </p>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-ink">DNS Verification Record</h3>
        <p className="text-xs text-ink-3">
          Add this TXT record to your domain&apos;s DNS to prove ownership.
        </p>
        <div className="grid grid-cols-1 gap-3">
          {[
            { label: 'Record type', value: 'TXT'        },
            { label: 'Host / Name', value: '@'           },
            { label: 'Value',       value: TXT_RECORD    },
            { label: 'TTL',         value: '300 (5 min)' },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-3 p-3 bg-canvas border border-edge rounded-xl">
              <span className="text-2xs font-semibold text-ink-3 uppercase tracking-wide w-24 shrink-0">{row.label}</span>
              <code className="flex-1 text-xs font-mono text-ink-2 break-all">{row.value}</code>
              {row.label === 'Value' && <CopyBtn text={row.value} />}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {!verified && (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="flex items-center gap-2 bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-accent-hover transition-colors disabled:opacity-60"
            >
              {verifying
                ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                : <Check className="w-4 h-4" />}
              {verifying ? 'Checking…' : 'Verify Now'}
            </button>
          )}
          <p className="text-2xs text-ink-3">DNS propagation takes 1–5 minutes.</p>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">Robots.txt Management</h3>
          <span className="text-2xs font-semibold px-2 py-0.5 rounded-full bg-accent-muted text-accent">Coming soon</span>
        </div>
        <p className="text-xs text-ink-3">
          ScraperKast will auto-manage your <code className="font-mono text-xs bg-canvas px-1 py-0.5 rounded border border-edge">robots.txt</code> to
          signal pricing to compliant scrapers.
        </p>
        <div className="bg-canvas border border-edge rounded-xl p-4">
          <pre className="text-xs font-mono text-ink-3 leading-relaxed">{`User-agent: GPTBot
# ScraperKast: charge=0.001 USDC
Disallow:

User-agent: Scrapy
Disallow: /

User-agent: *
Allow: /`}</pre>
        </div>
      </div>
    </div>
  );
}

// ── Notifications sub-tab ─────────────────────────────────────────────────────

interface NotifToggle { id: string; label: string; desc: string; enabled: boolean; }

function NotificationsTab() {
  const [email,      setEmail]      = useState('founder@techblog.io');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [notifs,     setNotifs]     = useState<NotifToggle[]>([
    { id: 'new_bot',     label: 'New bot detected',     desc: "A bot type we haven't seen before hits your site.",   enabled: true  },
    { id: 'payout',      label: 'Payout sent',          desc: 'USDC auto-withdrawal to your wallet completes.',      enabled: true  },
    { id: 'block_spike', label: 'Block spike',          desc: 'More than 500 bots blocked in a 1-hour window.',      enabled: true  },
    { id: 'weekly',      label: 'Weekly digest',        desc: 'Summary of revenue, top bots, and blocked requests.', enabled: true  },
    { id: 'verify_fail', label: 'Domain verify failed', desc: 'DNS verification lapses.',                            enabled: false },
    { id: 'api_error',   label: 'Middleware errors',    desc: 'ScraperKast middleware throws repeated errors.',       enabled: false },
  ]);

  function toggle(id: string) {
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, enabled: !n.enabled } : n));
  }

  return (
    <div className="space-y-6">
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2">
          <Mail className="w-4 h-4 text-ink-3" />
          Email Notifications
        </h3>
        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5">Notification email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input max-w-sm" />
        </div>
        <div className="space-y-0">
          {notifs.map(n => (
            <div key={n.id} className="flex items-start gap-4 py-3 border-b border-edge last:border-0">
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink">{n.label}</p>
                <p className="text-xs text-ink-3 mt-0.5">{n.desc}</p>
              </div>
              <ToggleSwitch enabled={n.enabled} onChange={() => toggle(n.id)} />
            </div>
          ))}
        </div>
      </div>
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-ink flex items-center gap-2">
          <Webhook className="w-4 h-4 text-ink-3" />
          Webhook
        </h3>
        <p className="text-xs text-ink-3">POST events to your own endpoint (Slack, Discord, n8n).</p>
        <div>
          <label className="block text-xs font-semibold text-ink-2 mb-1.5">Webhook URL</label>
          <input type="url" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.slack.com/services/…" className="input max-w-md" />
        </div>
        <div className="bg-canvas border border-edge rounded-xl p-4">
          <p className="text-2xs font-semibold text-ink-3 uppercase tracking-wide mb-2">Example payload</p>
          <pre className="text-xs font-mono text-ink-2 leading-relaxed overflow-x-auto">{`{
  "event":   "payout_sent",
  "siteId":  "site_techblog",
  "amount":  0.05,
  "wallet":  "0xD4fG…k3Hp",
  "network": "base-sepolia",
  "ts":      "2026-04-30T14:23:01Z"
}`}</pre>
        </div>
      </div>
      <div className="flex justify-end">
        <button className="flex items-center gap-2 bg-accent text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-accent-hover transition-colors">
          Save Notifications <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Danger Zone sub-tab ───────────────────────────────────────────────────────

function DangerTab({ siteId }: { siteId: string }) {
  const [confirmText, setConfirmText] = useState('');
  const [paused,      setPaused]      = useState(false);
  const DELETE_PHRASE = 'delete my site';

  return (
    <div className="space-y-6">
      <div className="card p-5 border-amber-200">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <ShieldOff className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-amber-700">
              {paused ? 'Protection is paused' : 'Pause protection'}
            </h3>
            <p className="text-xs text-amber-600 mt-0.5">
              Temporarily allow all bots through. Your data and rules are preserved.
            </p>
            <button
              onClick={() => setPaused(p => !p)}
              className={cn(
                'mt-3 flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl transition-colors',
                paused
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-amber-100 text-amber-700 border border-amber-200 hover:bg-amber-200',
              )}
            >
              {paused ? '▶ Resume protection' : '⏸ Pause protection'}
            </button>
          </div>
        </div>
      </div>

      <div className="card p-5 border-edge">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-xl bg-canvas flex items-center justify-center shrink-0">
            <RefreshCw className="w-4 h-4 text-ink-3" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-ink">Reset analytics</h3>
            <p className="text-xs text-ink-3 mt-0.5">Clear activity logs. Revenue history is preserved.</p>
            <button className="mt-3 text-sm font-semibold px-4 py-2 rounded-xl border border-edge text-ink-2 hover:bg-canvas transition-colors">
              Reset analytics data
            </button>
          </div>
        </div>
      </div>

      <div className="card p-5 border-red-200 bg-red-50/30">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <Trash2 className="w-4 h-4 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-700">Delete this site</h3>
            <p className="text-xs text-red-600 mt-0.5">
              Permanently removes all data, rules, and activity history. Cannot be undone.
            </p>
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-semibold text-red-600">
                Type <span className="font-mono bg-red-100 px-1.5 py-0.5 rounded">{DELETE_PHRASE}</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={e => setConfirmText(e.target.value)}
                placeholder={DELETE_PHRASE}
                className="input border-red-200 focus:ring-red-300 max-w-xs"
              />
            </div>
            <button
              disabled={confirmText !== DELETE_PHRASE}
              className="mt-3 flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 className="w-4 h-4" />
              Permanently delete site
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const [subTab, setSubTab] = useState<SubTab>('general');

  const SUB_TABS: { key: SubTab; label: string; danger?: boolean }[] = [
    { key: 'general',       label: 'General'       },
    { key: 'payment',       label: '💰 Payment'    },
    { key: 'domain',        label: 'Domain'        },
    { key: 'notifications', label: 'Notifications' },
    { key: 'danger',        label: 'Danger Zone',  danger: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-ink">Settings</h2>
        <p className="text-xs text-ink-3 mt-0.5">Manage your site configuration and revenue settings</p>
      </div>

      <div className="flex items-center gap-1 border-b border-edge overflow-x-auto pb-px">
        {SUB_TABS.map(({ key, label, danger }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all duration-150 rounded-t-lg border-b-2 -mb-px',
              subTab === key
                ? danger
                  ? 'border-red-500 text-red-600 font-semibold'
                  : 'border-accent text-accent font-semibold bg-accent-muted/40'
                : danger
                  ? 'border-transparent text-red-400 hover:text-red-600 hover:border-red-300'
                  : 'border-transparent text-ink-3 hover:text-ink hover:border-edge',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === 'general'       && <GeneralTab       siteId={siteId} />}
      {subTab === 'payment'       && <PaymentTab       siteId={siteId} />}
      {subTab === 'domain'        && <DomainTab        siteId={siteId} />}
      {subTab === 'notifications' && <NotificationsTab />}
      {subTab === 'danger'        && <DangerTab        siteId={siteId} />}
    </div>
  );
}
