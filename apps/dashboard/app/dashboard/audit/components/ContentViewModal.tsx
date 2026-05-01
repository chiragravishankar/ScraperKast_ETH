'use client';

import { useState } from 'react';
import {
  X, CheckCircle2, AlertTriangle, Download, FileText,
  Code, FileCode, Network,
} from 'lucide-react';
import type { ScraperResult, ContentRetrieved } from '@/app/api/audit/run/route';
import { cn } from '@/lib/utils';

interface Props {
  result:  ScraperResult;
  onClose: () => void;
}

type Tab = 'preview' | 'html' | 'markdown' | 'headers';

// ── Download helper ───────────────────────────────────────────────────────────

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Tab button ────────────────────────────────────────────────────────────────

function TabBtn({
  active, onClick, icon: Icon, label,
}: {
  active:  boolean;
  onClick: () => void;
  icon:    React.ElementType;
  label:   string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
        active
          ? 'bg-accent text-white'
          : 'text-ink-3 hover:text-ink hover:bg-edge-2',
      )}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

// ── Extraction badge row ──────────────────────────────────────────────────────

function ExtractionBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-md border',
      ok
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-canvas text-ink-3 border-edge',
    )}>
      {ok ? '✓' : '✗'} {label}
    </span>
  );
}

// ── Request details section ───────────────────────────────────────────────────

function RequestDetailsBadges({ rd }: {
  rd: NonNullable<ScraperResult['requestDetails']>;
}) {
  const items = [
    { label: 'Status',  value: `HTTP ${rd.httpStatus}` },
    { label: 'Time',    value: `${rd.timeMs} ms` },
    { label: 'Server',  value: rd.serverType },
    { label: 'CDN',     value: rd.cdnProvider },
    ...(rd.cdnRayId ? [{ label: 'Ray ID', value: rd.cdnRayId.slice(0, 16) + '…' }] : []),
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map(({ label, value }) => (
        <span key={label} className="inline-flex items-center gap-1 text-2xs bg-canvas border border-edge rounded-lg px-2 py-1 text-ink-3">
          <span className="font-semibold text-ink-2">{label}:</span> {value}
        </span>
      ))}
    </div>
  );
}

// ── Legacy fallback (no contentRetrieved) ─────────────────────────────────────

function LegacyView({ result }: { result: ScraperResult }) {
  const { name, contentPreview, contentLength, fullArticle, statusCode, timeMs, requestDetails } = result;

  function download() {
    downloadBlob(contentPreview, `${name.toLowerCase()}-scraped.txt`, 'text/plain');
  }

  return (
    <div className="p-5 space-y-4">
      {requestDetails && <RequestDetailsBadges rd={requestDetails} />}

      <div className="flex items-center gap-2">
        {fullArticle
          ? <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" />Full Article</span>
          : <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-full"><AlertTriangle className="w-3 h-3" />Partial Content</span>}
        <span className="text-xs text-ink-3 bg-canvas border border-edge px-2 py-0.5 rounded-full tabular-nums">
          {contentLength.toLocaleString()} bytes
        </span>
      </div>
      <div className="bg-canvas border border-edge rounded-xl p-4 font-mono text-xs text-ink-2 leading-relaxed max-h-52 overflow-y-auto whitespace-pre-wrap break-words">
        {contentPreview || '(No text content extracted)'}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'HTTP Status',    value: statusCode !== null ? `HTTP ${statusCode}` : '—' },
          { label: 'Response Size',  value: `${(contentLength / 1024).toFixed(1)} KB` },
          { label: 'Time to Extract', value: `${timeMs} ms` },
          { label: 'Article Complete', value: fullArticle ? 'Yes' : 'No (partial)' },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between bg-canvas border border-edge rounded-lg px-3 py-2">
            <span className="text-xs text-ink-3">{label}</span>
            <span className="text-xs font-semibold text-ink">{value}</span>
          </div>
        ))}
      </div>
      <button
        onClick={download}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-edge rounded-xl text-sm font-semibold text-ink hover:bg-edge-2 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Download Preview (.txt)
      </button>
    </div>
  );
}

// ── Rich view (contentRetrieved present) ──────────────────────────────────────

function RichView({ result }: { result: ScraperResult }) {
  const { name, contentRetrieved: content, statusCode, timeMs, requestDetails } = result;
  if (!content) return null;

  const [activeTab, setActiveTab] = useState<Tab>('preview');

  const headersJson   = requestDetails
    ? JSON.stringify(requestDetails.headers, null, 2)
    : '{}';
  const hasHeaders    = requestDetails && Object.keys(requestDetails.headers).length > 0;

  const tabContent: Record<Tab, string> = {
    preview:  content.plaintext,
    html:     content.html,
    markdown: content.markdown,
    headers:  headersJson,
  };

  const displayText = tabContent[activeTab];
  const slug        = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return (
    <div className="p-5 space-y-4">

      {/* Request details badges */}
      {requestDetails && <RequestDetailsBadges rd={requestDetails} />}

      {/* Article status + word count */}
      <div className="flex items-center gap-2 flex-wrap">
        {content.fullArticle ? (
          <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-2.5 py-1 rounded-full">
            <CheckCircle2 className="w-3 h-3" />
            Full Article Detected
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold px-2.5 py-1 rounded-full">
            <AlertTriangle className="w-3 h-3" />
            Partial Content
          </span>
        )}
        <span className="text-xs text-ink-3 bg-canvas border border-edge px-2 py-0.5 rounded-full tabular-nums">
          {content.characterCount.toLocaleString()} chars · {content.wordCount.toLocaleString()} words
        </span>
      </div>

      {/* Extraction chips */}
      <div className="flex flex-wrap gap-1.5">
        <ExtractionBadge ok={content.extracted.title}         label="Title" />
        <ExtractionBadge ok={content.extracted.mainContent}   label="Main content" />
        <ExtractionBadge ok={content.extracted.lastParagraph} label="Last paragraph" />
        <span className="inline-flex items-center gap-1 text-2xs font-medium px-2 py-0.5 rounded-md border bg-canvas text-ink-3 border-edge">
          {content.extracted.images} image{content.extracted.images !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'HTTP Status',   value: statusCode !== null ? `HTTP ${statusCode}` : '—' },
          { label: 'Response Size', value: `${(content.characterCount / 1024).toFixed(1)} KB` },
          { label: 'Time to Fetch', value: `${timeMs} ms` },
          { label: 'Full Article',  value: content.fullArticle ? 'Yes' : 'No (partial)' },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between bg-canvas border border-edge rounded-lg px-3 py-2">
            <span className="text-xs text-ink-3">{label}</span>
            <span className="text-xs font-semibold text-ink">{value}</span>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 p-1 bg-canvas border border-edge rounded-xl flex-wrap">
        <TabBtn active={activeTab === 'preview'}  onClick={() => setActiveTab('preview')}  icon={FileText} label="Preview" />
        <TabBtn active={activeTab === 'html'}     onClick={() => setActiveTab('html')}     icon={Code}     label="HTML" />
        <TabBtn active={activeTab === 'markdown'} onClick={() => setActiveTab('markdown')} icon={FileCode} label="Markdown" />
        {hasHeaders && (
          <TabBtn active={activeTab === 'headers'} onClick={() => setActiveTab('headers')} icon={Network}  label="Headers" />
        )}
      </div>

      {/* Content area */}
      <div className="bg-canvas border border-edge rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-edge">
          <span className="text-2xs text-ink-3 font-medium uppercase tracking-wide">
            {activeTab === 'preview'  ? 'Plain text (first 10 KB)'
             : activeTab === 'html'   ? 'HTML source (first 50 KB)'
             : activeTab === 'markdown' ? 'Markdown conversion'
             : `Response headers (${Object.keys(requestDetails?.headers ?? {}).length})`}
          </span>
          <span className="text-2xs text-ink-3 tabular-nums">
            {displayText.length.toLocaleString()} chars
          </span>
        </div>
        <pre className="p-4 font-mono text-xs text-ink-2 leading-relaxed max-h-60 overflow-y-auto scrollbar-thin whitespace-pre-wrap break-words">
          {displayText || '(empty)'}
        </pre>
      </div>

      {/* Download row — hide "Download Headers" tab button in download row */}
      {activeTab !== 'headers' && (
        <div className="flex gap-2">
          <button
            onClick={() => downloadBlob(content.html, `${slug}-scraped.html`, 'text/html')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-edge rounded-xl text-xs font-semibold text-ink hover:bg-edge-2 transition-colors"
          >
            <Download className="w-3 h-3" />
            Download HTML
          </button>
          <button
            onClick={() => downloadBlob(content.markdown, `${slug}-scraped.md`, 'text/markdown')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-edge rounded-xl text-xs font-semibold text-ink hover:bg-edge-2 transition-colors"
          >
            <Download className="w-3 h-3" />
            Download Markdown
          </button>
          <button
            onClick={() => downloadBlob(content.plaintext, `${slug}-scraped.txt`, 'text/plain')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 border border-edge rounded-xl text-xs font-semibold text-ink hover:bg-edge-2 transition-colors"
          >
            <Download className="w-3 h-3" />
            Download Text
          </button>
        </div>
      )}

      {/* Headers tab: download button */}
      {activeTab === 'headers' && hasHeaders && (
        <button
          onClick={() => downloadBlob(headersJson, `${slug}-headers.json`, 'application/json')}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-edge rounded-xl text-xs font-semibold text-ink hover:bg-edge-2 transition-colors"
        >
          <Download className="w-3 h-3" />
          Download Headers (.json)
        </button>
      )}
    </div>
  );
}

// ── Modal shell ───────────────────────────────────────────────────────────────

export default function ContentViewModal({ result, onClose }: Props) {
  const { name, tier, company, contentRetrieved } = result;

  const tierLabel: Record<string, string> = {
    ai:         '🤖 AI Bot',
    premium:    '🔴 Premium',
    midtier:    '🟡 Mid-Tier',
    opensource: '🟢 Open Source',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg bg-surface rounded-2xl shadow-popover border border-edge overflow-hidden max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge shrink-0">
          <div>
            <p className="font-bold text-ink text-sm">Content Retrieved</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-ink-3">{name}</p>
              {company && <span className="text-2xs text-ink-3">· {company}</span>}
              <span className="text-2xs font-medium text-ink-3 bg-canvas border border-edge px-1.5 py-0.5 rounded">
                {tierLabel[tier] ?? tier}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-ink-3 hover:text-ink p-1 rounded-lg hover:bg-edge-2 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {contentRetrieved
            ? <RichView result={result} />
            : <LegacyView result={result} />}
        </div>
      </div>
    </div>
  );
}
