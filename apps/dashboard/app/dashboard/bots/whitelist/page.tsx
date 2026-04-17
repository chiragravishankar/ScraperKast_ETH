'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Unlock, Lock, Plus, Trash2, Search, ExternalLink } from 'lucide-react';
import { useBotStore, ALL_BOTS } from '@/lib/botStore';
import type { BotDef } from '@/lib/botStore';

// ── List section ──────────────────────────────────────────────────────────────

function BotList({
  title, icon: Icon, bots, accentClass, emptyMsg,
  onRemove, onAdd, addLabel,
}: {
  title:       string;
  icon:        React.ElementType;
  bots:        BotDef[];
  accentClass: string;
  emptyMsg:    string;
  onRemove:    (id: string) => void;
  onAdd:       (id: string) => void;
  addLabel:    string;
}) {
  const { getConfig } = useBotStore();
  const [search, setSearch] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const pickerBots = ALL_BOTS.filter(b => {
    const cfg = getConfig(b.id);
    const notInList = !bots.find(lb => lb.id === b.id);
    const matchSearch = b.name.toLowerCase().includes(search.toLowerCase()) || b.company.toLowerCase().includes(search.toLowerCase());
    return notInList && (!search || matchSearch);
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
      {/* Header */}
      <div className={`px-5 py-4 border-b border-slate-100 flex items-center justify-between ${accentClass}`}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <h2 className="font-bold text-base">{title}</h2>
          <span className="text-sm font-medium opacity-70">({bots.length})</span>
        </div>
        <button onClick={() => setShowPicker(v => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold border border-current/30 rounded-lg px-3 py-1.5 hover:opacity-80 transition-opacity">
          <Plus className="w-3.5 h-3.5" /> {addLabel}
        </button>
      </div>

      {/* Picker dropdown */}
      {showPicker && (
        <div className="border-b border-slate-100 p-3 bg-slate-50">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" placeholder="Search bots…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark bg-white" />
          </div>
          <div className="max-h-36 overflow-y-auto space-y-0.5">
            {pickerBots.slice(0, 10).map(b => (
              <button key={b.id} onClick={() => { onAdd(b.id); setSearch(''); setShowPicker(false); }}
                className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white text-sm transition-colors">
                <span className="font-medium text-slate-800">{b.name}</span>
                <span className="text-xs text-slate-400">{b.company}</span>
              </button>
            ))}
            {pickerBots.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">All bots added</p>
            )}
          </div>
        </div>
      )}

      {/* List */}
      <div className="flex-1 divide-y divide-slate-50">
        {bots.length === 0 ? (
          <div className="px-5 py-10 text-center text-slate-400 text-sm">
            <p>{emptyMsg}</p>
          </div>
        ) : bots.map(bot => (
          <div key={bot.id} className="px-5 py-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800 text-sm">{bot.name}</span>
                <span className="text-xs text-slate-400">{bot.company}</span>
                {bot.docUrl && (
                  <a href={bot.docUrl} target="_blank" rel="noopener noreferrer"
                    className="text-slate-300 hover:text-brand-dark transition-colors">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="text-xs font-mono text-slate-400 mt-0.5 truncate">{bot.userAgent}</p>
            </div>
            <button onClick={() => onRemove(bot.id)}
              className="shrink-0 p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WhitelistPage() {
  const { getConfig, updateConfig } = useBotStore();

  const whitelisted = ALL_BOTS.filter(b => getConfig(b.id).whitelisted);
  const blacklisted = ALL_BOTS.filter(b => getConfig(b.id).blacklisted);

  function addToWhitelist(id: string) {
    updateConfig(id, { whitelisted: true, blacklisted: false, accessLevel: 'free', status: 'allowed' });
  }
  function removeFromWhitelist(id: string) {
    updateConfig(id, { whitelisted: false, accessLevel: 'default' });
  }
  function addToBlacklist(id: string) {
    updateConfig(id, { blacklisted: true, whitelisted: false, accessLevel: 'default', status: 'blocked' });
  }
  function removeFromBlacklist(id: string) {
    updateConfig(id, { blacklisted: false, status: 'pending' });
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/bots/manage" className="text-slate-400 hover:text-slate-700 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Whitelist &amp; Blacklist</h1>
          <p className="text-sm text-slate-500 mt-0.5">Permanent allow or block overrides per bot</p>
        </div>
      </div>

      {/* Info boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <Unlock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-emerald-800">Whitelist — Always Free</p>
            <p className="text-emerald-700 mt-0.5">Whitelisted bots are always served without payment. Use for SEO crawlers, trusted partners, or internal tools.</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-700">Blacklist — Always Blocked</p>
            <p className="text-red-600 mt-0.5">Blacklisted bots receive 403 on every request regardless of payment. Use for abusive or unwanted scrapers.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BotList
          title="Whitelist"
          icon={Unlock}
          bots={whitelisted}
          accentClass="bg-emerald-50 text-emerald-800"
          emptyMsg="No bots whitelisted. Add SEO crawlers or trusted partners."
          onRemove={removeFromWhitelist}
          onAdd={addToWhitelist}
          addLabel="Add to Whitelist"
        />
        <BotList
          title="Blacklist"
          icon={Lock}
          bots={blacklisted}
          accentClass="bg-red-50 text-red-700"
          emptyMsg="No bots blacklisted. Add abusive scrapers or bad actors."
          onRemove={removeFromBlacklist}
          onAdd={addToBlacklist}
          addLabel="Add to Blacklist"
        />
      </div>
    </div>
  );
}
