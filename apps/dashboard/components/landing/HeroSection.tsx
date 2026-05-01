'use client';

import { Suspense } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const HeroCanvas = dynamic(() => import('./HeroCanvas'), { ssr: false });

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 z-0">
        <Suspense fallback={null}><HeroCanvas /></Suspense>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center pt-20">

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full mb-10 border"
          style={{ background: 'rgba(255,255,255,0.75)', borderColor: 'rgba(26,26,46,0.1)', backdropFilter: 'blur(16px)' }}
        >
          <span className="w-2 h-2 rounded-full animate-pulse"
                style={{ background: 'linear-gradient(135deg, #FF9A76, #B794F6)' }} />
          <span className="text-sm font-medium" style={{ color: '#4A4A6A' }}>
            Live on Base Sepolia · ETHGlobal 2026
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="font-display font-bold leading-[1.08] mb-8"
          style={{ fontSize: 'clamp(3rem,8vw,6.5rem)', color: '#1A1A2E' }}
        >
          Turn AI scrapers<br />
          into{' '}
          <span style={{
            background: 'linear-gradient(135deg, #FF9A76, #B794F6, #7BA7FF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            revenue
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-xl md:text-2xl font-light leading-relaxed mb-4 max-w-2xl mx-auto"
          style={{ color: '#4A4A6A' }}
        >
          One line of middleware. Bots pay per request in USDC.{' '}
          <span className="font-semibold" style={{ color: '#1A1A2E' }}>
            You keep 100% of revenue.
          </span>
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
          className="text-base mb-12"
          style={{ color: '#8A8AA8' }}
        >
          We charge the bots, not you. Zero fees. Zero friction. Pure profit.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="flex gap-4 justify-center flex-wrap"
        >
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-lg text-white shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all"
            style={{ background: 'linear-gradient(135deg, #FF9A76, #B794F6)' }}
          >
            Start earning free
            <span className="group-hover:translate-x-1 inline-block transition-transform">→</span>
          </Link>

          <button
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-semibold text-lg border transition-all hover:bg-white/60"
            style={{ borderColor: 'rgba(26,26,46,0.15)', color: '#4A4A6A', backdropFilter: 'blur(12px)', background: 'rgba(255,255,255,0.5)' }}
          >
            <span className="w-7 h-7 rounded-full border flex items-center justify-center text-xs"
                  style={{ borderColor: 'rgba(26,26,46,0.2)' }}>▶</span>
            Watch 90s demo
          </button>
        </motion.div>

        {/* Live ticker */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-10 inline-flex items-center gap-3 px-5 py-2.5 rounded-full border text-sm"
          style={{ background: 'rgba(255,255,255,0.65)', borderColor: 'rgba(26,26,46,0.08)', backdropFilter: 'blur(12px)' }}
        >
          <span style={{ color: '#8A8AA8' }}>Live payments</span>
          <span style={{ color: 'rgba(26,26,46,0.2)' }}>—</span>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4ADE80' }} />
          <span className="font-semibold" style={{ color: '#1A1A2E' }}>GPTBot</span>
          <span style={{ color: '#8A8AA8' }}>2,847 reqs</span>
          <span className="font-semibold" style={{ color: '#FF9A76' }}>+$2.85</span>
        </motion.div>

        {/* Quick stats */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
          className="mt-10 flex items-center justify-center gap-10 flex-wrap"
        >
          {[
            { v: '$0.001',  l: 'per request',    c: '#FF9A76' },
            { v: '< 5 min', l: 'to deploy',      c: '#B794F6' },
            { v: '100%',    l: 'revenue to you', c: '#7BA7FF' },
            { v: '400ms',   l: 'settlement',     c: '#FFB3D9' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-sm font-bold mb-0.5" style={{ color: s.c }}>{s.v}</div>
              <div className="text-xs" style={{ color: '#8A8AA8' }}>{s.l}</div>
            </div>
          ))}
        </motion.div>
      </div>

    </section>
  );
}
