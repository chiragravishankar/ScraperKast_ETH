'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useBotStore } from '@/lib/botStore';
import type { BotDef, AccessLevel, BotStatus } from '@/lib/botStore';

interface BotQuickEditProps {
  bot:     BotDef;
  onClose: () => void;
}

export default function BotQuickEdit({ bot, onClose }: BotQuickEditProps) {
  const { getConfig, updateConfig } = useBotStore();
  const cfg = getConfig(bot.id);

  const [status,      setStatus]      = useState<BotStatus>(cfg.status);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(cfg.accessLevel);
  const [pricePerPage, setPricePerPage] = useState(cfg.customPricing.pricePerPage / 1_000_000); // USDC
  const [saved, setSaved] = useState(false);

  function handleSave() {
    updateConfig(bot.id, {
      status,
      accessLevel,
      customPricing: {
        ...cfg.customPricing,
        pricePerPage: Math.round(pricePerPage * 1_000_000),
      },
    });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 700);
  }

  return (
    <tr className="bg-brand-dark/[0.03] border-b border-slate-100">
      <td colSpan={8} className="px-4 py-3">
        <div className="flex flex-wrap items-end gap-4">

          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</p>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
              {(['allowed','blocked','pending'] as BotStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`px-3 py-1.5 font-medium capitalize transition-colors ${
                    status === s
                      ? s === 'allowed' ? 'bg-emerald-600 text-white' : s === 'blocked' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Access level */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Access Level</p>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
              {(['default','free','custom'] as AccessLevel[]).map(a => (
                <button
                  key={a}
                  onClick={() => setAccessLevel(a)}
                  className={`px-3 py-1.5 font-medium capitalize transition-colors ${
                    accessLevel === a
                      ? 'bg-brand-dark text-white'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Custom price — only when custom selected */}
          {accessLevel === 'custom' && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Price / Page (USDC)</p>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={pricePerPage}
                  onChange={e => setPricePerPage(parseFloat(e.target.value) || 0)}
                  className="w-28 pl-6 pr-3 py-1.5 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-dark/30 focus:border-brand-dark"
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={handleSave}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                saved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-brand-dark text-white hover:bg-brand-mid'
              }`}
            >
              <Check className="w-3.5 h-3.5" />
              {saved ? 'Saved!' : 'Save'}
            </button>
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100 transition-colors border border-slate-200"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
