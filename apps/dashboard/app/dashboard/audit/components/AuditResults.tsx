'use client';

import '../styles.css';
import { useState } from 'react';
import {
  CheckCircle2, XCircle, AlertTriangle, ArrowRight, Zap, Eye,
  GitBranch, Bot, Server,
} from 'lucide-react';
import type { AuditPayload, ScraperResult, Remediation, TierBreakdown } from '@/app/api/audit/run/route';
import { cn } from '@/lib/utils';
import ContentViewModal from './ContentViewModal';
import AttackPathModal  from './AttackPathModal';

// ── Score ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const stroke = 10;
  const circ   = 2 * Math.PI * radius;
  const filled = circ * (score / 100);

  const { color, label, bg } =
    score >= 70 ? { color: '#10b981', label: 'Low Risk',    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : score >= 40 ? { color: '#f59e0b', label: 'Medium Risk', bg: 'bg-amber-50   text-amber-700   border-amber-200'   }
    :               { color: '#ef4444', label: 'High Risk',   bg: 'bg-red-50     text-red-700     border-red-200'     };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={radius} fill="none" stroke="var(--color-edge,#e5e7eb)" strokeWidth={stroke} />
          <circle cx="64" cy="64" r={radius} fill="none" stroke={color} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circ - filled}`}
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-ink tabular-nums leading-none">{score}</span>
          <span className="text-xs text-ink-3 font-medium mt-0.5">/ 100</span>
        </div>
      </div>
      <span className={cn('text-xs font-semibold px-3 py-1 rounded-full border', bg)}>{label}</span>
    </div>
  );
}

// ── Stat box ──────────────────────────────────────────────────────────────────

function StatBox({ label, value, variant = 'neutral' }: {
  label:    string;
  value:    number;
  variant?: 'neutral' | 'green' | 'red' | 'blue';
}) {
  const cls = {
    neutral: 'bg-canvas border-edge text-ink',
    green:   'bg-emerald-50 border-emerald-200 text-emerald-700',
    red:     'bg-red-50 border-red-200 text-red-700',
    blue:    'bg-blue-50 border-blue-200 text-blue-700',
  }[variant];

  const textCls = {
    neutral: 'text-ink-3',
    green:   'text-emerald-600',
    red:     'text-red-600',
    blue:    'text-blue-600',
  }[variant];

  return (
    <div className={cn('text-center p-3 rounded-xl border', cls)}>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className={cn('text-xs mt-0.5', textCls)}>{label}</p>
    </div>
  );
}

// ── Tier bar (vulnerability breakdown) ───────────────────────────────────────

function TierBar({ label, tested, exposed }: { label: string; tested: number; exposed: number }) {
  const pct   = tested > 0 ? Math.round((exposed / tested) * 100) : 0;
  const color = pct >= 70 ? 'bg-red-500' : pct >= 40 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-semibold text-ink">{label}</span>
        <span className="text-xs text-ink-3 tabular-nums">{exposed}/{tested} exposed ({pct}%)</span>
      </div>
      <div className="h-2 bg-edge rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Scraper card ──────────────────────────────────────────────────────────────

function ScraperCard({
  result,
  onViewContent,
  onViewPath,
}: {
  result:        ScraperResult;
  onViewContent: () => void;
  onViewPath:    () => void;
}) {
  const {
    name, success, blocked, tier, company, techniques, timeMs, difficulty,
    contentLength, fullArticle, error, contentRetrieved, requestDetails,
  } = result;

  const isError = !success && !blocked;
  const isAi    = tier === 'ai';

  const statusCfg = isError
    ? { label: 'Skipped', cls: 'bg-amber-50 text-amber-700 border-amber-200', Icon: AlertTriangle, dotCls: 'skipped' }
    : success
      ? { label: 'Exposed', cls: 'bg-red-50 text-red-700 border-red-200',       Icon: XCircle,       dotCls: 'exposed' }
      : { label: 'Blocked', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', Icon: CheckCircle2, dotCls: 'blocked' };

  // CSS class controls 2px border + glow — Tailwind `border` class removed from outer div
  const cardTheme = success ? 'card-exposed' : blocked ? 'card-blocked' : 'card-skipped';

  return (
    <div className={cn(
      'scraper-card',
      'rounded-2xl bg-surface flex flex-col gap-3 p-4',
      cardTheme,
      isAi && !success && !isError && 'bg-blue-50/20',
    )}>

      {/* ── Header: indicator dot + name + status badge ── */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {/* Pulsing indicator dot */}
            <div className={cn('indicator-dot', statusCfg.dotCls)} />
            {isAi && <Bot className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
            <p className="text-sm font-bold text-ink truncate leading-snug">{name}</p>
          </div>
          {company && isAi && (
            <p className="text-2xs text-ink-3 mt-0.5 pl-4">{company}</p>
          )}
        </div>
        <span className={cn(
          'inline-flex items-center gap-1 text-2xs font-bold px-2 py-0.5 rounded-full border shrink-0',
          statusCfg.cls,
          success && 'badge-exposed',
        )}>
          <statusCfg.Icon className="w-3 h-3" />
          {statusCfg.label}
        </span>
      </div>

      {/* ── Full article badge ── */}
      {success && (contentRetrieved?.fullArticle ?? fullArticle) && (
        <span className="self-start text-2xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
          Full article retrieved
        </span>
      )}

      {/* ── Technique pills (show first 2, then +N) ── */}
      <div className="flex flex-wrap gap-1">
        {techniques.slice(0, 2).map(t => (
          <span key={t} className="text-2xs bg-canvas border border-edge px-1.5 py-0.5 rounded-md text-ink-3 leading-snug">
            {t}
          </span>
        ))}
        {techniques.length > 2 && (
          <span className="text-2xs text-ink-3 px-1 py-0.5 self-center">
            +{techniques.length - 2} more
          </span>
        )}
      </div>

      {/* ── Server / CDN badge ── */}
      {requestDetails && (requestDetails.serverType !== 'Unknown' || requestDetails.cdnProvider !== 'None detected') && (
        <div className="flex items-center gap-1.5 bg-canvas border border-edge rounded-lg px-2 py-1.5">
          <Server className="w-3 h-3 text-ink-3 shrink-0" />
          <span className="text-2xs text-ink-3 truncate">
            {requestDetails.serverType !== 'Unknown'
              ? requestDetails.serverType
              : requestDetails.cdnProvider}
            {requestDetails.cdnProvider !== 'None detected' && requestDetails.serverType !== 'Unknown'
              ? ` · ${requestDetails.cdnProvider}`
              : ''}
          </span>
        </div>
      )}

      {/* ── Error message (Skipped cards) ── */}
      {isError && error && (
        <p className="text-2xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1.5 border border-amber-200 leading-relaxed">
          {error}
        </p>
      )}

      {/* ── Stats row ── */}
      <div className="flex items-center justify-between text-2xs text-ink-3 tabular-nums mt-auto">
        <span>{timeMs > 0 ? `${timeMs} ms` : '—'}</span>
        {!isAi && <span className="text-ink-3">{difficulty}/10 difficulty</span>}
        {success && contentRetrieved ? (
          <span>{contentRetrieved.wordCount.toLocaleString()} words</span>
        ) : success ? (
          <span>{(contentLength / 1024).toFixed(1)} KB</span>
        ) : null}
      </div>

      {/* ── Action buttons ── */}
      {(success || (!isError && result.attackPath.length > 0)) && (
        <div className="flex items-center gap-1 pt-2 border-t border-edge -mx-1">
          {success && (
            <button
              onClick={onViewContent}
              className="flex-1 flex items-center justify-center gap-1 text-xs font-semibold text-accent hover:underline py-1 rounded-lg hover:bg-accent/5 transition-colors"
            >
              <Eye className="w-3 h-3" />
              Content
            </button>
          )}
          {result.attackPath.length > 0 && (
            <button
              onClick={onViewPath}
              className={cn(
                'flex items-center justify-center gap-1 text-xs font-semibold text-ink-2 hover:text-ink hover:underline py-1 rounded-lg hover:bg-edge-2 transition-colors',
                success ? 'px-3' : 'flex-1',
              )}
            >
              <GitBranch className="w-3 h-3" />
              {success ? 'Path' : blocked ? 'How blocked' : 'Details'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Results section (tier header + 3-col card grid) ───────────────────────────

const TIER_META: Record<string, { label: string; emoji: string }> = {
  ai:         { label: 'AI Company Bots',   emoji: '🤖' },
  premium:    { label: 'Premium Scrapers',  emoji: '🔴' },
  midtier:    { label: 'Mid-Tier Scrapers', emoji: '🟡' },
  opensource: { label: 'Open Source Tools', emoji: '🟢' },
};

function ResultsSection({
  tier,
  results,
  onViewContent,
  onViewPath,
}: {
  tier:          string;
  results:       ScraperResult[];
  onViewContent: (r: ScraperResult) => void;
  onViewPath:    (r: ScraperResult) => void;
}) {
  const { label, emoji }    = TIER_META[tier] ?? { label: tier, emoji: '⚪' };
  const exposed             = results.filter(r => r.success).length;
  const isAiTier            = tier === 'ai';

  const badgeCls =
    exposed === results.length ? 'bg-red-50 text-red-700 border-red-200'
    : exposed === 0             ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    :                            'bg-amber-50 text-amber-700 border-amber-200';

  return (
    <div>
      {/* Section header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3 rounded-xl border mb-3',
        isAiTier ? 'bg-blue-50/60 border-blue-100' : 'bg-canvas border-edge',
      )}>
        <div>
          <h3 className="text-sm font-bold text-ink">{emoji} {label}</h3>
          {isAiTier && (
            <p className="text-2xs text-ink-3 mt-0.5">
              Declared identity · {results.filter(r => r.respectsRobotsTxt).length}/{results.length} respect robots.txt
            </p>
          )}
        </div>
        <span className={cn('text-xs font-semibold px-2.5 py-0.5 rounded-full border', badgeCls)}>
          {exposed}/{results.length} exposed
        </span>
      </div>

      {/* 3-column card grid — responsive via scraper-grid CSS class */}
      <div className="scraper-grid grid grid-cols-1 gap-3">
        {results.map(r => (
          <ScraperCard
            key={r.name}
            result={r}
            onViewContent={() => onViewContent(r)}
            onViewPath={() => onViewPath(r)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Remediation card ──────────────────────────────────────────────────────────

function RemediationCard({ rem, index }: { rem: Remediation; index: number }) {
  const priorityStyle: Record<string, string> = {
    high:   'bg-red-50    text-red-700    border-red-200',
    medium: 'bg-amber-50  text-amber-700  border-amber-200',
    low:    'bg-sky-50    text-sky-700    border-sky-200',
  };

  return (
    <div className="flex gap-4 p-4 rounded-xl border border-edge bg-surface hover:border-ink-3 transition-colors">
      <div className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <p className="text-sm font-bold text-ink">{rem.title}</p>
          <span className={cn('text-2xs font-semibold px-2 py-0.5 rounded-full border capitalize shrink-0', priorityStyle[rem.priority])}>
            {rem.priority}
          </span>
        </div>
        <p className="text-sm text-ink-2 mt-1 leading-relaxed">{rem.description}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          <span className="text-xs text-ink-3"><span className="font-semibold text-ink-2">Impact:</span> {rem.impact}</span>
          <span className="text-xs text-ink-3"><span className="font-semibold text-ink-2">Effort:</span> {rem.effort}</span>
        </div>
        {rem.willBlock && rem.willBlock.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            <span className="text-2xs text-ink-3 mr-1">Blocks:</span>
            {rem.willBlock.map(n => (
              <span key={n} className="text-2xs bg-canvas border border-edge px-1.5 py-0.5 rounded-md text-ink-3">
                {n}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function AuditResults({
  result,
  onReset,
}: {
  result:  AuditPayload;
  onReset: () => void;
}) {
  const [contentModal, setContentModal] = useState<ScraperResult | null>(null);
  const [pathModal,    setPathModal]    = useState<ScraperResult | null>(null);

  const { targetUrl, vulnerabilityScore, results } = result;
  const { tests, remediations, summary, tierBreakdown } = results;

  const aiBots     = tests.filter(t => t.tier === 'ai');
  const premium    = tests.filter(t => t.tier === 'premium');
  const midtier    = tests.filter(t => t.tier === 'midtier');
  const opensource = tests.filter(t => t.tier === 'opensource');

  const aiExposed    = aiBots.filter(t => t.success).length;
  const commTests    = tests.filter(t => t.tier !== 'ai');
  const exposedCount = tests.filter(t => t.success).length;
  const blockedCount = tests.filter(t => t.blocked).length;

  return (
    <>
      {/* Modals */}
      {contentModal && <ContentViewModal result={contentModal} onClose={() => setContentModal(null)} />}
      {pathModal    && <AttackPathModal  result={pathModal}    onClose={() => setPathModal(null)} />}

      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-ink">Audit Complete</h2>
            <p className="text-sm text-ink-3 mt-0.5 break-all">{targetUrl}</p>
          </div>
          <button onClick={onReset} className="text-sm font-semibold text-accent hover:underline shrink-0">
            Run another audit
          </button>
        </div>

        {/* ── Score + stats ── */}
        <div className="card p-6 flex flex-col sm:flex-row items-center gap-8">
          <ScoreRing score={vulnerabilityScore} />
          <div className="flex-1 space-y-4">
            <p className="text-sm text-ink-2 leading-relaxed">{summary}</p>
            <div className="grid grid-cols-4 gap-2">
              <StatBox label="Tests Run"  value={tests.length} />
              <StatBox label="AI Exposed" value={aiExposed}    variant="blue" />
              <StatBox label="Blocked"    value={blockedCount} variant="green" />
              <StatBox label="Exposed"    value={exposedCount} variant="red" />
            </div>
          </div>
        </div>

        {/* ── AI bots section ── */}
        {aiBots.length > 0 && (
          <ResultsSection
            tier="ai"
            results={aiBots}
            onViewContent={setContentModal}
            onViewPath={setPathModal}
          />
        )}

        {/* ── Commercial scrapers ── */}
        {commTests.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <h3 className="text-xs font-semibold text-ink-3 uppercase tracking-wide">
                Commercial Scrapers
              </h3>
              <div className="flex-1 h-px bg-edge" />
              <span className="text-xs text-ink-3 tabular-nums">
                {commTests.filter(t => t.success).length}/{commTests.length} exposed
              </span>
            </div>

            {premium.length    > 0 && <ResultsSection tier="premium"    results={premium}    onViewContent={setContentModal} onViewPath={setPathModal} />}
            {midtier.length    > 0 && <ResultsSection tier="midtier"    results={midtier}    onViewContent={setContentModal} onViewPath={setPathModal} />}
            {opensource.length > 0 && <ResultsSection tier="opensource" results={opensource} onViewContent={setContentModal} onViewPath={setPathModal} />}
          </div>
        )}

        {/* ── Vulnerability breakdown by tier ── */}
        {tierBreakdown && (
          <div className="card p-5">
            <h3 className="text-sm font-bold text-ink mb-4">Vulnerability by Tier</h3>
            <div className="space-y-3.5">
              {(tierBreakdown as TierBreakdown).ai && (
                <TierBar label="🤖 AI Company Bots"  {...(tierBreakdown as TierBreakdown).ai!} />
              )}
              <TierBar label="🔴 Premium Scrapers"  {...(tierBreakdown as TierBreakdown).premium} />
              <TierBar label="🟡 Mid-Tier Scrapers" {...(tierBreakdown as TierBreakdown).midtier} />
              <TierBar label="🟢 Open Source Tools" {...(tierBreakdown as TierBreakdown).opensource} />
            </div>
          </div>
        )}

        {/* ── Remediations ── */}
        {remediations.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-ink mb-3">Recommended Actions</h3>
            <div className="space-y-3">
              {remediations.map((rem, i) => <RemediationCard key={rem.title} rem={rem} index={i} />)}
            </div>
          </div>
        )}

        {/* ── CTA ── */}
        <div className="card p-6 bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-accent uppercase tracking-wide mb-1">
                {exposedCount > 0
                  ? `🚨 ${exposedCount} bot${exposedCount > 1 ? 's' : ''} accessing your content`
                  : 'ScraperKast Monitoring'}
              </p>
              <h3 className="font-bold text-ink">Install ScraperKast Monitoring</h3>
              <p className="text-sm text-ink-2 mt-1 leading-relaxed">
                Get real-time alerts when scrapers hit your site, see exactly which commercial tools
                and AI bots are active, and auto-enforce per-request USDC pricing — so they pay
                instead of getting your content for free.
              </p>
              <button className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline">
                Get started — 15 min setup <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </>
  );
}
