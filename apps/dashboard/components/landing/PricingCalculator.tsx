'use client';

import { useRef, useState } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

export default function PricingCalculator() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  const [visitors,    setVisitors]    = useState(50_000);
  const [botPct,      setBotPct]      = useState(15);
  const [pricePerReq, setPricePerReq] = useState(0.001);

  const botReqs    = Math.floor(visitors * (botPct / 100));
  const dailyRev   = botReqs * pricePerReq * 0.95;
  const monthlyRev = dailyRev * 30;
  const yearlyRev  = dailyRev * 365;

  return (
    <section id="pricing" ref={ref} className="relative py-28 px-6 overflow-hidden" style={{ background: '#F8F9FF' }}>
      <div className="lp-sep absolute inset-x-0 top-0" />

      {/* Bg accent */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 80%, rgba(123,167,255,0.07) 0%, transparent 60%)' }} />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity:0, y:16 }} animate={inView?{opacity:1,y:0}:{}} transition={{ duration:0.5 }}
                    className="text-center mb-14">
          <p className="lp-label mb-3">Pricing</p>
          <h2 className="font-bold tracking-tight" style={{ fontSize:'clamp(2rem,4.5vw,3.5rem)', color:'#1A1A2E' }}>
            Calculate your <span className="lp-gradient-text">earnings</span>
          </h2>
          <p className="mt-4 text-lg max-w-xl mx-auto" style={{ color:'#4A4A6A' }}>
            Drag the sliders — see exactly what you&apos;d earn based on your traffic.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity:0, y:30 }}
          animate={inView?{opacity:1,y:0}:{}}
          transition={{ duration:0.6, ease:[0.16,1,0.3,1] }}
          className="grid grid-cols-1 lg:grid-cols-5 gap-5"
        >
          {/* Sliders panel */}
          <div className="lp-card lg:col-span-3 p-8 space-y-8">
            <SoftSlider
              label="Daily visitors"
              value={visitors}
              min={1000}
              max={1_000_000}
              step={1000}
              accent="#FF9A76"
              format={v => v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)}
              onChange={setVisitors}
            />
            <SoftSlider
              label="Bot traffic %"
              value={botPct}
              min={1}
              max={60}
              step={1}
              accent="#B794F6"
              format={v => `${v}%`}
              onChange={setBotPct}
            />
            <SoftSlider
              label="Price per request"
              value={pricePerReq}
              min={0.0001}
              max={0.01}
              step={0.0001}
              accent="#7BA7FF"
              format={v => `$${v.toFixed(4)}`}
              onChange={setPricePerReq}
            />

            {/* Bot mix bar */}
            <div>
              <p className="text-xs font-medium tracking-wide uppercase mb-3" style={{ color:'#8A8AA8' }}>
                Bot mix (estimated)
              </p>
              <div className="flex h-2 rounded-full overflow-hidden gap-px">
                {[
                  { color:'#7BA7FF', flex:1.8 },
                  { color:'#B794F6', flex:1.5 },
                  { color:'#FF9A76', flex:2.1 },
                  { color:'#FFB3D9', flex:0.8 },
                ].map((b, i) => (
                  <div key={i} className="rounded-sm" style={{ background:b.color, flex:b.flex }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                {[
                  { label:'GPTBot',   color:'#7BA7FF' },
                  { label:'ClaudeBot',color:'#B794F6' },
                  { label:'Google',   color:'#FF9A76' },
                  { label:'Other',    color:'#FFB3D9' },
                ].map((b, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs" style={{ color:'#8A8AA8' }}>
                    <span className="w-2 h-2 rounded-full" style={{ background:b.color }} />
                    {b.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Revenue display */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            {/* Main number */}
            <div className="lp-card p-7 flex-1 flex flex-col justify-between"
                 style={{ background:'linear-gradient(135deg, rgba(255,154,118,0.06), rgba(183,148,246,0.06))' }}>
              <div>
                <p className="text-xs font-medium tracking-wide uppercase mb-3" style={{ color:'#8A8AA8' }}>
                  Monthly revenue
                </p>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={Math.round(monthlyRev)}
                    initial={{ opacity:0, scale:1.05 }}
                    animate={{ opacity:1, scale:1 }}
                    transition={{ duration:0.25 }}
                    className="font-bold leading-none lp-gradient-text"
                    style={{ fontSize:'clamp(2.5rem,5vw,4rem)' }}
                  >
                    {fmt(monthlyRev)}
                  </motion.p>
                </AnimatePresence>
                <p className="mt-2 text-sm" style={{ color:'#8A8AA8' }}>
                  {fmt(yearlyRev)}/yr · {botReqs.toLocaleString()} reqs/day
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t" style={{ borderColor:'rgba(26,26,46,0.07)' }}>
                <div>
                  <p className="text-xs" style={{ color:'#8A8AA8' }}>Daily</p>
                  <p className="text-lg font-bold mt-0.5" style={{ color:'#FF9A76' }}>{fmt(dailyRev)}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color:'#8A8AA8' }}>Yearly</p>
                  <p className="text-lg font-bold mt-0.5" style={{ color:'#B794F6' }}>{fmt(yearlyRev)}</p>
                </div>
              </div>
            </div>

            {/* Fee breakdown */}
            <div className="lp-card p-5 text-sm space-y-2.5">
              <div className="flex justify-between">
                <span style={{ color:'#8A8AA8' }}>Gross</span>
                <span style={{ color:'#4A4A6A' }}>{fmt(botReqs * pricePerReq * 30)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color:'#8A8AA8' }}>Platform fee (5%)</span>
                <span style={{ color:'#B794F6' }}>−{fmt(botReqs * pricePerReq * 30 * 0.05)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t" style={{ borderColor:'rgba(26,26,46,0.07)' }}>
                <span style={{ color:'#1A1A2E' }}>Your earnings</span>
                <span style={{ color:'#FF9A76' }}>{fmt(monthlyRev)}</span>
              </div>
            </div>

            <Link href="/dashboard" className="lp-btn-primary justify-center text-sm py-3.5 px-6">
              Start earning free →
            </Link>

            <p className="text-center text-xs" style={{ color:'#8A8AA8' }}>
              No setup fees · Cancel anytime
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── Soft slider ───────────────────────────────────────────────────────────────

interface SoftSliderProps {
  label:    string;
  value:    number;
  min:      number;
  max:      number;
  step:     number;
  accent:   string;
  format:   (v: number) => string;
  onChange: (v: number) => void;
}

function SoftSlider({ label, value, min, max, step, accent, format, onChange }: SoftSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="relative">
      <div className="flex justify-between mb-3">
        <label className="text-sm font-medium" style={{ color:'#4A4A6A' }}>{label}</label>
        <span className="text-sm font-bold" style={{ color: accent }}>{format(value)}</span>
      </div>
      <div className="relative h-1.5 rounded-full" style={{ background:'rgba(26,26,46,0.08)' }}>
        {/* Fill */}
        <div className="absolute h-full rounded-full transition-all"
             style={{ width:`${pct}%`, background:`linear-gradient(90deg, ${accent}99, ${accent})` }} />
        {/* Hidden native range for interaction */}
        <input
          type="range"
          min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ height:'100%' }}
        />
        {/* Thumb */}
        <div
          className="absolute w-4 h-4 rounded-full border-2 shadow-md pointer-events-none -translate-y-1/2 -translate-x-1/2 top-1/2"
          style={{ left:`${pct}%`, background:'#fff', borderColor:accent, boxShadow:`0 0 0 3px ${accent}22` }}
        />
      </div>
    </div>
  );
}
