'use client';

import { useRef, useState, useEffect } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';

const STEPS = [
  {
    id: '01', label: 'Detect',
    desc: 'Edge-side identification of 200+ AI crawlers using UA patterns, TLS fingerprints, and behavioral signals. Adds <1ms latency.',
    color: '#FF9A76',
    lines: [
      { t:'> Incoming request...', c:'#8A8AA8' },
      { t:'> User-Agent: GPTBot/1.1', c:'#4A4A6A' },
      { t:'> TLS fingerprint match: OpenAI', c:'#4A4A6A' },
      { t:'✓ GPTBot identified · Tier: PAID', c:'#FF9A76' },
    ],
  },
  {
    id: '02', label: 'Charge',
    desc: 'Bot presents a signed USDC micropayment via x402 on Base Sepolia or Uniswap ERC-20 swap. No human interaction required.',
    color: '#B794F6',
    lines: [
      { t:'> Payment challenge issued', c:'#8A8AA8' },
      { t:'> Price: 1,000 µUSDC ($0.001)', c:'#4A4A6A' },
      { t:'> Methods: USDC · Stripe · Lightning', c:'#4A4A6A' },
      { t:'✓ Payment received', c:'#B794F6' },
    ],
  },
  {
    id: '03', label: 'Verify',
    desc: 'Payment confirmed on Base Sepolia in ~2s. Permanent, public, unforgeable. Transaction visible on BaseScan.',
    color: '#7BA7FF',
    lines: [
      { t:'> Verifying on-chain...', c:'#8A8AA8' },
      { t:'> Tx: 4xF8...Hy2K (confirmed)', c:'#4A4A6A' },
      { t:'> Split: 95% owner | 5% platform', c:'#4A4A6A' },
      { t:'✓ Access granted', c:'#7BA7FF' },
    ],
  },
  {
    id: '04', label: 'Settle',
    desc: '95% lands in your Ethereum wallet in seconds. Withdraw to any Ethereum address anytime.',
    color: '#4ADE80',
    lines: [
      { t:'> Transferring to owner...', c:'#8A8AA8' },
      { t:'> Wallet: 7xKX...9mPq', c:'#4A4A6A' },
      { t:'> Balance: +$127.43 today', c:'#4A4A6A' },
      { t:'✓ Revenue settled on-chain', c:'#4ADE80' },
    ],
  },
];

function TerminalLine({ text, color, delay }: { text:string; color:string; delay:number }) {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t); }, [delay]);
  if (!show) return null;
  return (
    <motion.p initial={{ opacity:0, x:-6 }} animate={{ opacity:1, x:0 }} transition={{ duration:0.22 }}
              className="font-mono text-sm leading-7" style={{ color }}>{text}</motion.p>
  );
}

export default function HowItWorksSection() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once:true, margin:'-80px' });
  const [active, setActive] = useState(0);
  const step = STEPS[active];

  return (
    <section id="how-it-works" ref={ref} className="relative py-28 px-6 overflow-hidden" style={{ background:'#FFFFFF' }}>
      <div className="lp-sep absolute inset-x-0 top-0" />

      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity:0, y:16 }} animate={inView?{opacity:1,y:0}:{}} transition={{ duration:0.5 }}
                    className="text-center mb-16">
          <p className="lp-label mb-4">How it works</p>
          <h2 className="font-display font-bold tracking-tight" style={{ fontSize:'clamp(2.5rem,5.5vw,5rem)', color:'#1A1A2E' }}>
            From zero to paid in{' '}
            <span style={{
              background:'linear-gradient(135deg, #FF9A76, #B794F6)',
              WebkitBackgroundClip:'text',
              WebkitTextFillColor:'transparent',
              backgroundClip:'text',
            }}>5 minutes</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Step list */}
          <motion.div initial={{ opacity:0, x:-20 }} animate={inView?{opacity:1,x:0}:{}} transition={{ duration:0.5 }}
                      className="space-y-2">
            {STEPS.map((s, i) => {
              const on = active === i;
              return (
                <button key={s.id} onClick={() => setActive(i)}
                        className="w-full text-left px-5 py-4 rounded-xl transition-all duration-200 border"
                        style={{ borderColor: on?`${s.color}30`:'transparent', background: on?`${s.color}08`:'transparent' }}>
                  <div className="flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 transition-all"
                         style={{ background: on?s.color:'rgba(26,26,46,0.06)', color: on?'#fff':'#8A8AA8' }}>
                      {s.id}
                    </div>
                    <div className="flex-1 pt-1.5">
                      <p className="font-semibold text-sm transition-colors"
                         style={{ color: on?s.color:'#4A4A6A' }}>{s.label}</p>
                      {on && (
                        <motion.p initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }}
                                  className="text-sm mt-1.5 leading-relaxed" style={{ color:'#8A8AA8' }}>
                          {s.desc}
                        </motion.p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </motion.div>

          {/* Terminal panel */}
          <motion.div initial={{ opacity:0, x:20 }} animate={inView?{opacity:1,x:0}:{}} transition={{ duration:0.5, delay:0.1 }}
                      className="sticky top-24 rounded-2xl overflow-hidden border shadow-xl"
                      style={{ borderColor:'rgba(26,26,46,0.08)', background:'#1A1A2E' }}>
            {/* Chrome */}
            <div className="flex items-center gap-2 px-5 py-3.5 border-b" style={{ borderColor:'rgba(255,255,255,0.08)', background:'#141422' }}>
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ background:'#FF5F57' }} />
                <span className="w-3 h-3 rounded-full" style={{ background:'#FEBC2E' }} />
                <span className="w-3 h-3 rounded-full" style={{ background:'#28C840' }} />
              </div>
              <span className="ml-3 text-xs font-mono" style={{ color:'rgba(255,255,255,0.3)' }}>scraperkast.log</span>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background:'#4ADE80' }} />
                <span className="text-xs font-mono" style={{ color:'#4ADE80' }}>LIVE</span>
              </div>
            </div>

            {/* Step tabs */}
            <div className="flex border-b" style={{ borderColor:'rgba(255,255,255,0.06)' }}>
              {STEPS.map((s,i) => (
                <button key={s.id} onClick={() => setActive(i)}
                        className="flex-1 py-2.5 text-xs font-semibold transition-all"
                        style={{ color: active===i?'#fff':'rgba(255,255,255,0.3)',
                                 background: active===i?s.color:'transparent' }}>
                  {s.label}
                </button>
              ))}
            </div>

            {/* Output */}
            <AnimatePresence mode="wait">
              <motion.div key={active} initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                          transition={{ duration:0.2 }} className="p-6 min-h-[180px] space-y-1">
                {step.lines.map((l,i) => (
                  <TerminalLine key={`${active}-${i}`} text={l.t} color={l.c} delay={i*200} />
                ))}
                <span className="lp-cursor" style={{ background: step.color }} />
              </motion.div>
            </AnimatePresence>

            {/* Progress */}
            <div className="flex items-center gap-3 px-6 py-3 border-t" style={{ borderColor:'rgba(255,255,255,0.06)' }}>
              <div className="flex-1 h-0.5 rounded-full" style={{ background:'rgba(255,255,255,0.08)' }}>
                <motion.div animate={{ width:`${((active+1)/STEPS.length)*100}%` }} transition={{ duration:0.4 }}
                            className="h-full rounded-full" style={{ background: step.color }} />
              </div>
              <span className="text-xs font-mono" style={{ color:'rgba(255,255,255,0.25)' }}>{active+1}/{STEPS.length}</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
