'use client';

import { useRef, useState } from 'react';
import {
  Globe, CreditCard, Zap, Code2, Shield, Bell, Settings2,
  Eye, EyeOff, Copy, Check, RefreshCw, Send, Plus, Trash2,
  Download, Upload, AlertTriangle, Search, Save, Clock,
  ChevronDown, ExternalLink, Info,
} from 'lucide-react';
import { useSettings, SettingsStoreProvider } from '@/lib/settingsStore';
import type { AllSettings } from '@/lib/settingsStore';
import CopyButton from '@/components/CopyButton';
import NetworkBadge from '@/components/NetworkBadge';

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-2 mb-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {hint && <p className="text-xs text-ink-3 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-ink-2 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-ink-3">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder = '', mono = false, readOnly = false, type = 'text' }: {
  value: string | number; onChange?: (v: string) => void;
  placeholder?: string; mono?: boolean; readOnly?: boolean; type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      readOnly={readOnly}
      placeholder={placeholder}
      onChange={e => onChange?.(e.target.value)}
      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark transition-colors
        ${mono ? 'font-mono' : ''}
        ${readOnly ? 'bg-canvas text-ink-3 cursor-default border-edge' : 'bg-white text-ink border-edge'}`}
    />
  );
}

function Textarea({ value, onChange, placeholder = '', rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2.5 rounded-xl border border-edge text-sm bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark resize-none"
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { val: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-edge text-sm bg-white text-ink focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark">
        {options.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-3 pointer-events-none" />
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string;
}) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 cursor-pointer group">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 group-hover:text-ink">{label}</p>
        {hint && <p className="text-xs text-ink-3 mt-0.5">{hint}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-10 h-5.5 rounded-full transition-colors shrink-0 mt-0.5 ${checked ? 'bg-brand-dark' : 'bg-slate-200'}`}
        style={{ height: '22px', width: '40px' }}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : ''}`} />
      </button>
    </label>
  );
}

function Divider() { return <div className="border-t border-edge-2 my-5" />; }

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`card p-5 space-y-5 ${className}`}>{children}</div>;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

type Tab = 'general' | 'payment' | 'automation' | 'api' | 'security' | 'notifications' | 'advanced';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'general',       label: 'General',         icon: Globe      },
  { id: 'payment',       label: 'Payment',          icon: CreditCard },
  { id: 'automation',    label: 'Automation',       icon: Zap        },
  { id: 'api',           label: 'API & Integration',icon: Code2      },
  { id: 'security',      label: 'Security',         icon: Shield     },
  { id: 'notifications', label: 'Notifications',    icon: Bell       },
  { id: 'advanced',      label: 'Advanced',         icon: Settings2  },
];

// ── Tab content ───────────────────────────────────────────────────────────────

function GeneralTab() {
  const { settings, update } = useSettings();
  const g = settings.general;
  const set = (patch: Partial<AllSettings['general']>) => update('general', patch);

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="Website Information" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Site Name">
            <Input value={g.siteName} onChange={v => set({ siteName: v })} placeholder="My Blog" />
          </Field>
          <Field label="Domain" hint="Auto-detected from middleware">
            <Input value={g.domain} readOnly />
          </Field>
        </div>
        <Field label="Description">
          <Textarea value={g.description} onChange={v => set({ description: v })} placeholder="A short description of your website…" rows={2} />
        </Field>
      </Card>

      <Card>
        <SectionHeader title="Regional Settings" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Timezone">
            <Select value={g.timezone} onChange={v => set({ timezone: v })} options={[
              { val:'UTC',       label:'UTC'              },
              { val:'US/Eastern',label:'US/Eastern'       },
              { val:'US/Pacific',label:'US/Pacific'       },
              { val:'Europe/London', label:'Europe/London'},
              { val:'Europe/Berlin', label:'Europe/Berlin'},
              { val:'Asia/Tokyo',    label:'Asia/Tokyo'   },
            ]} />
          </Field>
          <Field label="Currency Display">
            <Select value={g.currencyDisplay} onChange={v => set({ currencyDisplay: v as typeof g.currencyDisplay })} options={[
              { val:'USD', label:'USD ($)' }, { val:'EUR', label:'EUR (€)' }, { val:'GBP', label:'GBP (£)' },
            ]} />
          </Field>
          <Field label="Date Format">
            <Select value={g.dateFormat} onChange={v => set({ dateFormat: v as typeof g.dateFormat })} options={[
              { val:'MM/DD/YYYY', label:'MM/DD/YYYY' },
              { val:'DD/MM/YYYY', label:'DD/MM/YYYY' },
              { val:'YYYY-MM-DD', label:'YYYY-MM-DD' },
            ]} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Default Behaviors" hint="Applied when no specific rule or bot config overrides them" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Default Bot Action">
            <Select value={g.defaultBotAction} onChange={v => set({ defaultBotAction: v as typeof g.defaultBotAction })} options={[
              { val:'allow',   label:'Auto-allow' },
              { val:'block',   label:'Auto-block' },
              { val:'pending', label:'Require Approval' },
            ]} />
          </Field>
          <Field label="Default License Type">
            <Select value={g.defaultLicense} onChange={v => set({ defaultLicense: v as typeof g.defaultLicense })} options={[
              { val:'summarization', label:'Summarization' },
              { val:'training',      label:'Training'      },
              { val:'full_access',   label:'Full Access'   },
              { val:'custom',        label:'Custom'        },
            ]} />
          </Field>
        </div>
        <Divider />
        <Toggle checked={g.freeTierEnabled} onChange={v => set({ freeTierEnabled: v })}
          label="Enable Free Tier" hint="Allow bots a configurable number of free requests before charging" />
        {g.freeTierEnabled && (
          <Field label="Free Tier Limit (requests/day)" hint="Applies globally; per-rule overrides take priority">
            <Input type="number" value={g.freeTierLimit} onChange={v => set({ freeTierLimit: Math.max(0, parseInt(v)||0) })} />
          </Field>
        )}
      </Card>
    </div>
  );
}

function PaymentTab() {
  const { settings, update } = useSettings();
  const p = settings.payment;
  const set = (patch: Partial<AllSettings['payment']>) => update('payment', patch);

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="Payment Configuration" />
        {/* Platform fee (read-only) */}
        <div className="flex items-center justify-between bg-canvas rounded-xl px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-ink">ScraperKast Platform Fee</p>
            <p className="text-xs text-ink-3 mt-0.5">Enforced on-chain — no trust required</p>
          </div>
          <span className="text-2xl font-bold text-brand-dark">5%</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div className="bg-brand-dark h-2 rounded-full" style={{ width: '95%' }} />
        </div>
        <div className="flex justify-between text-xs text-ink-2 -mt-3">
          <span>You keep <strong className="text-brand-dark">95%</strong></span>
          <span>Platform <strong>5%</strong></span>
        </div>

        <Divider />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Minimum Withdrawal (USDC)">
            <Input type="number" value={p.minWithdrawal} onChange={v => set({ minWithdrawal: parseFloat(v)||1 })} />
          </Field>
          <Field label="Auto-Withdraw Threshold (USDC)">
            <Input type="number" value={p.autoWithdrawThreshold} onChange={v => set({ autoWithdrawThreshold: parseFloat(v)||0 })} />
          </Field>
        </div>
        <Toggle checked={p.autoWithdrawEnabled} onChange={v => set({ autoWithdrawEnabled: v })}
          label="Enable Auto-Withdraw" hint="Automatically withdraw to your wallet when balance exceeds threshold" />
        <Field label="Withdrawal Wallet Address">
          <Input value={p.withdrawalWallet} onChange={v => set({ withdrawalWallet: v })} mono placeholder="0x… Ethereum address" />
        </Field>
      </Card>

      <Card>
        <SectionHeader title="Billing Information" hint="Used for invoice generation" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Business Name">
            <Input value={p.businessName} onChange={v => set({ businessName: v })} placeholder="Acme Inc." />
          </Field>
          <Field label="Tax ID / VAT Number">
            <Input value={p.taxId} onChange={v => set({ taxId: v })} placeholder="US123456789" />
          </Field>
        </div>
        <Field label="Invoice Email">
          <Input type="email" value={p.invoiceEmail} onChange={v => set({ invoiceEmail: v })} placeholder="billing@yourdomain.com" />
        </Field>
        <Field label="Billing Address">
          <Textarea value={p.billingAddress} onChange={v => set({ billingAddress: v })} placeholder="123 Main St, City, Country" rows={2} />
        </Field>
      </Card>

      <Card>
        <SectionHeader title="Invoice Settings" />
        <Toggle checked={p.generateInvoices} onChange={v => set({ generateInvoices: v })}
          label="Generate Invoices" hint="Automatically generate PDF invoices for each payment" />
        {p.generateInvoices && (
          <Field label="Invoice Frequency">
            <Select value={p.invoiceFrequency} onChange={v => set({ invoiceFrequency: v as typeof p.invoiceFrequency })} options={[
              { val:'monthly',         label:'Monthly' },
              { val:'per_transaction', label:'Per Transaction' },
            ]} />
          </Field>
        )}
      </Card>
    </div>
  );
}

function AutomationTab() {
  const { settings, update } = useSettings();
  const a = settings.automation;
  const set = (patch: Partial<AllSettings['automation']>) => update('automation', patch);

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="Bot Management Automation" />
        <div className="divide-y divide-slate-100">
          <Toggle checked={a.autoBlockSuspicious} onChange={v => set({ autoBlockSuspicious: v })}
            label="Auto-block suspicious bots"
            hint="Bots with unknown user-agents or excessive request rates are blocked automatically" />
          {a.autoBlockSuspicious && (
            <div className="py-3">
              <Field label="Suspicious threshold (requests/hour)">
                <Input type="number" value={a.suspiciousThresholdRph} onChange={v => set({ suspiciousThresholdRph: parseInt(v)||100 })} />
              </Field>
            </div>
          )}
          <Toggle checked={a.autoAllowVerified} onChange={v => set({ autoAllowVerified: v })}
            label="Auto-allow verified bots"
            hint="Known bot patterns (GPTBot, Googlebot, ClaudeBot, etc.) are allowed without manual review" />
          <Toggle checked={a.autoUpgradeToPaid} onChange={v => set({ autoUpgradeToPaid: v })}
            label="Auto-upgrade to paid tier"
            hint="When a bot exhausts its free requests, automatically start charging instead of blocking" />
        </div>
      </Card>

      <Card>
        <SectionHeader title="Financial Automation" />
        <div className="divide-y divide-slate-100">
          <Toggle checked={a.lowBalanceAlert} onChange={v => set({ lowBalanceAlert: v })}
            label="Low balance alert" hint="Send an alert when your platform balance drops below the threshold" />
          {a.lowBalanceAlert && (
            <div className="py-3">
              <Field label="Alert threshold (USDC)">
                <Input type="number" value={a.lowBalanceThreshold} onChange={v => set({ lowBalanceThreshold: parseFloat(v)||0 })} />
              </Field>
            </div>
          )}
          <Toggle checked={a.highRevenueAlert} onChange={v => set({ highRevenueAlert: v })}
            label="High revenue alert" hint="Notify when daily revenue exceeds a target" />
          {a.highRevenueAlert && (
            <div className="py-3">
              <Field label="Daily revenue target (USDC)">
                <Input type="number" value={a.highRevenueThreshold} onChange={v => set({ highRevenueThreshold: parseFloat(v)||0 })} />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <SectionHeader title="Scheduled Reports" />
        <div className="divide-y divide-slate-100">
          <Toggle checked={a.dailySummaryEmail} onChange={v => set({ dailySummaryEmail: v })}
            label="Daily summary email" hint="Receive a daily digest of requests, revenue, and bot activity" />
          {a.dailySummaryEmail && (
            <div className="py-3">
              <Field label="Send at (UTC)">
                <input type="time" value={a.dailySummaryTime}
                  onChange={e => set({ dailySummaryTime: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-edge text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
              </Field>
            </div>
          )}
          <Toggle checked={a.weeklyReport} onChange={v => set({ weeklyReport: v })}
            label="Weekly performance report" />
          {a.weeklyReport && (
            <div className="py-3">
              <Field label="Send on">
                <Select value={a.weeklyReportDay} onChange={v => set({ weeklyReportDay: v })} options={
                  ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => ({ val:d, label:d }))
                } />
              </Field>
            </div>
          )}
          <Toggle checked={a.realTimeAlerts} onChange={v => set({ realTimeAlerts: v })}
            label="Real-time alerts" hint="Instant notifications for blocked bots, high revenue events, and errors" />
        </div>
      </Card>
    </div>
  );
}

function APITab() {
  const { settings, update, regenApiKey } = useSettings();
  const api = settings.api;
  const set = (patch: Partial<AllSettings['api']>) => update('api', patch);

  const [showProd,       setShowProd]       = useState(false);
  const [showTest,       setShowTest]       = useState(false);
  const [showSecret,     setShowSecret]     = useState(false);
  const [confirmRegen,   setConfirmRegen]   = useState<'production'|'test'|null>(null);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [webhookResult,  setWebhookResult]  = useState<{ok: boolean; latency?: number}|null>(null);
  const [newIp,          setNewIp]          = useState('');

  function mask(key: string) { return key.slice(0, 12) + '••••••••••••••••'; }

  async function testWebhook() {
    if (!api.webhookUrl) return;
    setTestingWebhook(true);
    setWebhookResult(null);
    try {
      const res  = await fetch('/api/settings/webhook-test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: api.webhookUrl }),
      });
      const data = await res.json() as { success: boolean; latencyMs?: number };
      setWebhookResult({ ok: data.success, latency: data.latencyMs });
    } catch { setWebhookResult({ ok: false }); }
    setTestingWebhook(false);
  }

  const FRAMEWORK_SNIPPETS: Record<string, string> = {
    express: `import { scraperKast } from '@scraperkast/middleware-express';

app.use(scraperKast({
  jwtSecret:      process.env.JWT_SECRET,
  ethereum: {
    enabled:        true,
    network:        'base-sepolia',
    ownerWallet:    '${settings.payment.withdrawalWallet.slice(0,16)}…',
  },
  rules: [
    { id: 'blog', path: '/blog/*', pricePerPage: 1000 },
  ],
}));`,
    fastify: `import { scraperKastFastify } from '@scraperkast/middleware-fastify';

await fastify.register(scraperKastFastify, { /* same options */ });`,
    nextjs: `// middleware.ts (Next.js App Router)
export { scraperKastMiddleware as middleware } from '@scraperkast/middleware-nextjs';
export const config = { matcher: ['/((?!api|_next).*)'] };`,
    other: `// Coming soon — use the REST API to verify payments manually.
// POST /api/payments/verify { txHash, botId, path }`,
  };

  return (
    <div className="space-y-5">
      {/* API Keys */}
      <Card>
        <SectionHeader title="API Keys" />
        {[
          { label:'Production Key', key: api.productionKey, show: showProd, setShow: setShowProd, type: 'production' as const },
          { label:'Test Key',       key: api.testKey,       show: showTest, setShow: setShowTest, type: 'test'       as const },
        ].map(({ label, key, show, setShow, type }) => (
          <div key={type} className="bg-canvas rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide">{label}</p>
              <div className="flex items-center gap-1.5 text-xs text-ink-3">
                <Clock className="w-3 h-3" />
                {type === 'production'
                  ? `Created ${Math.round((Date.now() - api.prodKeyCreated) / 86_400_000)}d ago`
                  : 'For testing only'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 font-mono text-xs bg-white border border-edge rounded-lg px-3 py-2 text-ink truncate">
                {show ? key : mask(key)}
              </code>
              <button onClick={() => setShow(v => !v)} className="p-2 rounded-lg border border-edge text-ink-3 hover:text-ink hover:bg-slate-100 transition-colors bg-white">
                {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <CopyButton text={key} />
              <button onClick={() => setConfirmRegen(type)}
                className="p-2 rounded-lg border border-edge text-ink-3 hover:text-amber-600 hover:bg-amber-50 hover:border-amber-200 transition-colors bg-white">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {/* Regen confirmation */}
        {confirmRegen && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Regenerate {confirmRegen} key?</p>
                <p className="text-xs text-amber-700 mt-0.5">Your old key will stop working immediately. Update all middleware deployments before confirming.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { regenApiKey(confirmRegen); setConfirmRegen(null); }}
                className="px-3 py-1.5 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors">
                Regenerate
              </button>
              <button onClick={() => setConfirmRegen(null)}
                className="px-3 py-1.5 border border-amber-200 text-amber-700 text-sm font-semibold rounded-lg hover:bg-amber-100 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Webhooks */}
      <Card>
        <SectionHeader title="Webhooks" hint="ScraperKast will POST signed events to your URL" />
        <Field label="Webhook URL">
          <Input value={api.webhookUrl} onChange={v => set({ webhookUrl: v })} placeholder="https://yourdomain.com/webhooks/scraperkast" />
        </Field>
        <Field label="Webhook Secret">
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-xs bg-canvas border border-edge rounded-xl px-3 py-2.5 text-ink truncate">
              {showSecret ? api.webhookSecret : 'whsec_••••••••••••••••'}
            </code>
            <button onClick={() => setShowSecret(v => !v)}
              className="p-2.5 rounded-xl border border-edge text-ink-3 hover:text-ink bg-white transition-colors">
              {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <CopyButton text={api.webhookSecret} />
          </div>
        </Field>

        {/* Events */}
        <div>
          <p className="text-xs font-semibold text-ink-2 uppercase tracking-wide mb-2">Events</p>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['paymentReceived',     'Payment received'    ],
              ['botBlocked',         'Bot blocked'          ],
              ['balanceLow',         'Balance low'          ],
              ['withdrawalCompleted','Withdrawal completed' ],
            ] as const).map(([key, label]) => (
              <label key={key} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all text-sm ${api.webhookEvents[key] ? 'border-brand-dark bg-brand-dark/5 font-medium text-brand-dark' : 'border-edge text-ink-2 hover:border-slate-300'}`}>
                <input type="checkbox" className="accent-brand-dark shrink-0"
                  checked={api.webhookEvents[key]}
                  onChange={e => set({ webhookEvents: { ...api.webhookEvents, [key]: e.target.checked } })} />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Test webhook */}
        <div className="flex items-center gap-3">
          <button onClick={testWebhook} disabled={!api.webhookUrl || testingWebhook}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-dark text-white text-sm font-semibold rounded-xl hover:bg-brand-mid transition-colors disabled:opacity-40">
            <Send className="w-3.5 h-3.5" />
            {testingWebhook ? 'Sending…' : 'Send Test Event'}
          </button>
          {webhookResult && (
            <span className={`text-xs font-semibold flex items-center gap-1 ${webhookResult.ok ? 'text-emerald-600' : 'text-red-500'}`}>
              {webhookResult.ok ? <Check className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              {webhookResult.ok ? `200 OK · ${webhookResult.latency}ms` : 'Delivery failed'}
            </span>
          )}
        </div>
      </Card>

      {/* Code snippet */}
      <Card>
        <SectionHeader title="Middleware Setup" hint="Copy and paste into your app" />
        <Field label="Framework">
          <Select value={api.framework} onChange={v => set({ framework: v as typeof api.framework })} options={[
            { val:'express', label:'Express.js' }, { val:'fastify', label:'Fastify' },
            { val:'nextjs',  label:'Next.js'    }, { val:'other',   label:'Other'   },
          ]} />
        </Field>
        <div className="relative">
          <pre className="bg-slate-950 text-slate-100 text-xs rounded-xl p-4 overflow-x-auto leading-relaxed">
            {FRAMEWORK_SNIPPETS[api.framework]}
          </pre>
          <div className="absolute top-2 right-2">
            <CopyButton text={FRAMEWORK_SNIPPETS[api.framework] ?? ''} label="Copy" />
          </div>
        </div>
      </Card>

      {/* External integrations */}
      <Card>
        <SectionHeader title="External Integrations" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { name:'Slack',   desc:'Get notifications in Slack channels', available: true  },
            { name:'Discord', desc:'Post alerts to a Discord server',      available: true  },
            { name:'Zapier',  desc:'Connect to 5000+ apps via Zapier',     available: false },
            { name:'Stripe',  desc:'Multi-currency card payments',         available: false },
          ].map(int => (
            <div key={int.name} className={`flex items-center justify-between p-4 rounded-xl border ${int.available ? 'border-edge hover:border-brand-dark/30' : 'border-edge-2 bg-canvas'} transition-colors`}>
              <div>
                <p className="text-sm font-semibold text-slate-800">{int.name}</p>
                <p className="text-xs text-ink-3 mt-0.5">{int.desc}</p>
              </div>
              {int.available
                ? <button className="text-xs font-semibold px-3 py-1.5 border border-edge rounded-lg text-ink-2 hover:border-brand-dark hover:text-brand-dark transition-colors flex items-center gap-1">
                    Connect <ExternalLink className="w-3 h-3" />
                  </button>
                : <span className="text-xs text-ink-3 bg-slate-100 px-2 py-1 rounded-full">Coming soon</span>
              }
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SecurityTab() {
  const { settings, update } = useSettings();
  const s = settings.security;
  const set = (patch: Partial<AllSettings['security']>) => update('security', patch);
  const [newIp, setNewIp] = useState('');

  const AUDIT_EVENTS = [
    { time:'2 min ago',  event:'API key used',          type:'info'    },
    { time:'1 hr ago',   event:'Settings saved',         type:'info'    },
    { time:'3 hrs ago',  event:'Bot "ScraperAPI" blocked',type:'warning'},
    { time:'Yesterday',  event:'Withdrawal initiated',   type:'info'    },
    { time:'2 days ago', event:'Login from new IP',      type:'warning' },
  ];

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="Account Security" />
        <div className="divide-y divide-slate-100">
          <Toggle checked={s.twoFactorEnabled} onChange={v => set({ twoFactorEnabled: v })}
            label="Two-Factor Authentication (2FA)" hint="Adds an extra layer of security to your account" />
          {s.twoFactorEnabled && (
            <div className="py-3">
              <Field label="2FA Method">
                <Select value={s.twoFactorMethod} onChange={v => set({ twoFactorMethod: v as typeof s.twoFactorMethod })} options={[
                  { val:'authenticator', label:'Authenticator App (TOTP)' },
                  { val:'sms',           label:'SMS Text Message'         },
                ]} />
              </Field>
            </div>
          )}
          <div className="py-3">
            <Field label="Session Timeout">
              <Select value={String(s.sessionTimeout)} onChange={v => set({ sessionTimeout: parseInt(v) as typeof s.sessionTimeout })} options={[
                { val:'60',   label:'1 hour'  },
                { val:'240',  label:'4 hours' },
                { val:'1440', label:'24 hours'},
              ]} />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Access Control" />
        <Toggle checked={s.ipWhitelistEnabled} onChange={v => set({ ipWhitelistEnabled: v })}
          label="IP Whitelist" hint="Only allow dashboard access from specified IP addresses" />
        {s.ipWhitelistEnabled && (
          <div className="space-y-2">
            <div className="space-y-1">
              {s.allowedIPs.map((ip, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-canvas rounded-xl px-3 py-2">
                  <code className="flex-1 font-mono text-xs text-ink">{ip}</code>
                  <button onClick={() => set({ allowedIPs: s.allowedIPs.filter((_, i) => i !== idx) })}
                    className="text-edge hover:text-red-500 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {s.allowedIPs.length === 0 && (
                <p className="text-xs text-ink-3 italic px-3">No IPs added — add at least one to enable the whitelist</p>
              )}
            </div>
            <div className="flex gap-2">
              <Input value={newIp} onChange={setNewIp} placeholder="192.168.1.1 or 10.0.0.0/24" mono />
              <button onClick={() => { if (newIp.trim()) { set({ allowedIPs: [...s.allowedIPs, newIp.trim()] }); setNewIp(''); } }}
                className="px-3 py-2.5 bg-brand-dark text-white rounded-xl text-sm font-semibold hover:bg-brand-mid transition-colors flex items-center gap-1 shrink-0">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader title="Data Security" />
        <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
          <p className="text-sm font-medium text-emerald-800">Encryption</p>
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">Enabled (AES-256)</span>
        </div>
        <div className="grid grid-cols-2 gap-4 pt-1">
          <Field label="Data Retention">
            <Select value={String(s.dataRetentionDays)} onChange={v => set({ dataRetentionDays: parseInt(v) as typeof s.dataRetentionDays })} options={[
              { val:'30', label:'30 days' }, { val:'60', label:'60 days' }, { val:'90', label:'90 days' },
            ]} />
          </Field>
          <div className="flex items-end">
            <div className="w-full">
              <Toggle checked={s.autoDeleteOldData} onChange={v => set({ autoDeleteOldData: v })}
                label="Auto-delete old data" hint={`After ${s.dataRetentionDays} days`} />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Audit Log" hint="Recent security-relevant events" />
        <div className="space-y-0 divide-y divide-slate-50">
          {AUDIT_EVENTS.map((e, i) => (
            <div key={i} className="flex items-center gap-3 py-3 text-sm">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.type === 'warning' ? 'bg-amber-400' : 'bg-slate-300'}`} />
              <span className="flex-1 text-ink">{e.event}</span>
              <span className="text-xs text-ink-3 shrink-0">{e.time}</span>
            </div>
          ))}
        </div>
        <button className="text-sm font-semibold text-brand-dark hover:text-brand-mid transition-colors flex items-center gap-1">
          View Full Log <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </Card>
    </div>
  );
}

function NotificationsTab() {
  const { settings, update } = useSettings();
  const n = settings.notifications;
  const set = (patch: Partial<AllSettings['notifications']>) => update('notifications', patch);

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="Notification Channels" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Email Address" hint="Primary notification email">
            <Input type="email" value={n.email} onChange={v => set({ email: v })} placeholder="you@yourdomain.com" />
          </Field>
          <Field label="SMS / Phone" hint="Optional — for critical alerts only">
            <Input type="tel" value={n.sms} onChange={v => set({ sms: v })} placeholder="+1 555 000 0000" />
          </Field>
        </div>
        {/* External channels */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {['Slack','Discord','Telegram'].map(ch => (
            <button key={ch} className="flex items-center justify-center gap-2 py-2.5 border border-dashed border-slate-300 rounded-xl text-sm text-ink-2 hover:border-brand-dark hover:text-brand-dark transition-colors">
              <Plus className="w-3.5 h-3.5" /> Connect {ch}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader title="Email Notifications" />
        <div className="divide-y divide-slate-100">
          {([
            ['dailySummary',        'Daily summary',           'Overview of requests, revenue, and bot activity'],
            ['weeklyReport',        'Weekly report',           'Full performance breakdown delivered every week' ],
            ['paymentReceived',     'Payment received',        'Instant notification when a bot pays'            ],
            ['withdrawalCompleted', 'Withdrawal completed',    'Confirm when USDC lands in your wallet'          ],
            ['botBlocked',         'Bot blocked',              'Alert when a bot hits a block rule'              ],
            ['lowBalance',         'Low balance',              'Alert when earnings balance drops low'           ],
            ['highRevenue',        'High revenue milestone',   'Celebrate hitting a daily revenue target'        ],
            ['securityAlerts',     '🔒 Security alerts',       'Login attempts, API key usage (always on)'        ],
          ] as const).map(([key, label, hint]) => (
            <Toggle key={key}
              checked={n[key as keyof typeof n] as boolean}
              onChange={key === 'securityAlerts' ? () => {} : v => set({ [key]: v })}
              label={label} hint={hint} />
          ))}
        </div>
      </Card>

      <Card>
        <SectionHeader title="Quiet Hours" hint="Suppress non-critical notifications during these hours" />
        <Toggle checked={n.quietHoursEnabled} onChange={v => set({ quietHoursEnabled: v })}
          label="Enable Quiet Hours" />
        {n.quietHoursEnabled && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Quiet from">
                <input type="time" value={n.quietFrom} onChange={e => set({ quietFrom: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-edge text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
              </Field>
              <Field label="Quiet until">
                <input type="time" value={n.quietTo} onChange={e => set({ quietTo: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl border border-edge text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark" />
              </Field>
            </div>
            <Toggle checked={n.quietAllowCritical} onChange={v => set({ quietAllowCritical: v })}
              label="Still send critical alerts during quiet hours"
              hint="Security events and very low balance alerts bypass quiet hours" />
          </div>
        )}
      </Card>
    </div>
  );
}

function AdvancedTab() {
  const { settings, update, reset, exportAll, importAll } = useSettings();
  const av = settings.advanced;
  const set = (patch: Partial<AllSettings['advanced']>) => update('advanced', patch);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError,   setImportError]   = useState<string|null>(null);
  const [confirmReset,  setConfirmReset]  = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [exportDone,    setExportDone]    = useState(false);

  function handleExport() {
    const blob = new Blob([exportAll()], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'scraperkast-settings.json'; a.click();
    URL.revokeObjectURL(url);
    setExportDone(true); setTimeout(() => setExportDone(false), 2000);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = importAll(ev.target?.result as string);
      if (!result.ok) setImportError(result.error ?? 'Import failed');
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="Developer Options" />
        <div className="divide-y divide-slate-100">
          <Toggle checked={av.debugMode}        onChange={v => set({ debugMode: v })}
            label="Debug Mode"        hint="Adds verbose headers to responses for troubleshooting" />
          <Toggle checked={av.verboseLogging}   onChange={v => set({ verboseLogging: v })}
            label="Verbose Logging"   hint="Log all middleware decisions to stdout" />
          <Toggle checked={av.testMode}         onChange={v => set({ testMode: v })}
            label="Test Mode (Testnet)" hint="Use Base Sepolia testnet — transactions have no real value" />
          <Toggle checked={av.maintenanceMode}  onChange={v => set({ maintenanceMode: v })}
            label="Maintenance Mode"  hint="Return 503 to all bots while you update rules" />
        </div>
        {av.maintenanceMode && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="text-red-700 font-medium">Maintenance mode is ON — all bot requests are returning 503.</span>
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader title="Performance" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Request Logging">
            <Select value={av.requestLogging} onChange={v => set({ requestLogging: v as typeof av.requestLogging })} options={[
              { val:'full',    label:'Full'    },
              { val:'minimal', label:'Minimal' },
              { val:'none',    label:'None'    },
            ]} />
          </Field>
          <Field label="Analytics Sampling">
            <Select value={String(av.analyticsSampling)} onChange={v => set({ analyticsSampling: parseInt(v) as typeof av.analyticsSampling })} options={[
              { val:'100', label:'100% (all)' },
              { val:'50',  label:'50%'        },
              { val:'10',  label:'10%'        },
            ]} />
          </Field>
          <div className="flex items-end">
            <Toggle checked={av.cacheEnabled} onChange={v => set({ cacheEnabled: v })} label="Enable Cache" />
          </div>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Beta Features" />
        <Toggle checked={av.betaFeatures} onChange={v => set({ betaFeatures: v })}
          label="Opt in to beta features" hint="Try new features before they're released publicly" />
        {av.betaFeatures && (
          <div className="space-y-2 pl-2 border-l-2 border-brand-dark/20">
            {([
              ['betaAIPricing',     'AI-powered pricing suggestions', 'Let AI recommend optimal prices based on bot behavior'],
              ['betaMultiCurrency', 'Multi-currency support',          'Display prices in EUR, GBP, JPY alongside USDC'       ],
              ['betaTeamCollab',    'Team collaboration',              'Invite team members with role-based access'            ],
            ] as const).map(([key, label, hint]) => (
              <Toggle key={key} checked={av[key as keyof typeof av] as boolean}
                onChange={v => set({ [key]: v })} label={label} hint={hint} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionHeader title="Data Management" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button onClick={handleExport}
            className="flex items-center justify-center gap-2 py-3 border border-edge rounded-xl text-sm font-semibold text-ink hover:bg-canvas transition-colors">
            {exportDone ? <><Check className="w-4 h-4 text-emerald-500" /> Exported!</> : <><Download className="w-4 h-4" /> Export All Data</>}
          </button>
          <button onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-2 py-3 border border-edge rounded-xl text-sm font-semibold text-ink hover:bg-canvas transition-colors">
            <Upload className="w-4 h-4" /> Import Config
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <button onClick={() => setConfirmReset(true)}
            className="flex items-center justify-center gap-2 py-3 border border-red-200 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
            <RefreshCw className="w-4 h-4" /> Reset to Defaults
          </button>
        </div>

        {importError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
            <span className="flex-1 text-red-700">{importError}</span>
            <button onClick={() => setImportError(null)} className="text-red-400 hover:text-red-600"><AlertTriangle className="w-3.5 h-3.5" /></button>
          </div>
        )}

        {/* Reset confirmation */}
        {confirmReset && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Reset all settings to defaults?</p>
                <p className="text-sm text-red-700 mt-1">This will overwrite all your customizations. Pricing rules, bot configs, and wallet connections are stored separately and won&apos;t be affected.</p>
              </div>
            </div>
            <Field label='Type "RESET" to confirm'>
              <Input value={resetConfirmText} onChange={setResetConfirmText} placeholder="RESET" />
            </Field>
            <div className="flex gap-2">
              <button
                onClick={() => { reset(); setConfirmReset(false); setResetConfirmText(''); }}
                disabled={resetConfirmText !== 'RESET'}
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Reset Settings
              </button>
              <button onClick={() => { setConfirmReset(false); setResetConfirmText(''); }}
                className="px-4 py-2 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-100 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function SettingsPageInner() {
  const { dirty, lastSaved, save } = useSettings();
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [search,    setSearch]    = useState('');

  // Save toast
  const [saved, setSaved] = useState(false);
  function handleSave() {
    save();
    setSaved(true);
    setTimeout(() => setSaved(false), 2_500);
  }

  const TAB_CONTENT: Record<Tab, React.ReactNode> = {
    general:       <GeneralTab />,
    payment:       <PaymentTab />,
    automation:    <AutomationTab />,
    api:           <APITab />,
    security:      <SecurityTab />,
    notifications: <NotificationsTab />,
    advanced:      <AdvancedTab />,
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-ink">Settings</h1>
          <p className="text-sm text-ink-2 mt-0.5">Platform configuration and automation</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Last saved */}
          {lastSaved && (
            <span className="text-xs text-ink-3 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Saved {Math.round((Date.now() - lastSaved) / 1000)}s ago
            </span>
          )}
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-3" />
            <input type="text" placeholder="Search settings…" value={search} onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl border border-edge text-sm bg-white w-40 focus:w-56 focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark transition-all" />
          </div>
          {/* Save button */}
          <button onClick={handleSave}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              saved ? 'bg-emerald-600 text-white' :
              dirty ? 'bg-brand-dark text-white hover:bg-brand-mid shadow-sm' :
              'bg-slate-100 text-ink-3 cursor-default'
            }`}>
            {saved ? <><Check className="w-4 h-4" /> Saved!</> : <><Save className="w-4 h-4" />{dirty ? 'Save Changes' : 'No Changes'}</>}
          </button>
        </div>
      </div>

      {/* Unsaved changes banner */}
      {dirty && !saved && (
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="text-amber-800 font-medium">You have unsaved changes.</span>
          <button onClick={handleSave} className="ml-auto text-amber-800 font-semibold hover:underline">Save now</button>
        </div>
      )}

      {/* ── Tab bar + content ─────────────────────────────────────────── */}
      <div className="flex gap-6 flex-col lg:flex-row">

        {/* Sidebar tab nav */}
        <nav className="lg:w-44 shrink-0">
          <div className="lg:sticky lg:top-6 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0 ${
                    activeTab === tab.id
                      ? 'bg-brand-dark text-white shadow-sm'
                      : 'text-ink-2 hover:bg-slate-100 hover:text-ink'
                  }`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="hidden lg:block">{tab.label}</span>
                  <span className="lg:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Tab content */}
        <div className="flex-1 min-w-0">
          {TAB_CONTENT[activeTab]}
        </div>
      </div>
    </div>
  );
}

// Wrap with provider so settings state is isolated to this page subtree
export default function SettingsPage() {
  return (
    <SettingsStoreProvider>
      <SettingsPageInner />
    </SettingsStoreProvider>
  );
}
