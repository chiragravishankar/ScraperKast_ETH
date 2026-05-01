'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const STATS = [
  {
    value: '90B+',
    label: 'Monthly AI scrapes',
    sub:   'on publisher sites globally',
    gradient: 'linear-gradient(135deg, #FF9A76, #FFB3D9)',
  },
  {
    value: '$0',
    label: 'Publisher revenue from AI',
    sub:   'by default, without ScraperKast',
    gradient: 'linear-gradient(135deg, #7BA7FF, #B794F6)',
  },
  {
    value: '100%',
    label: 'Revenue with ScraperKast',
    sub:   'We charge bots. You keep everything.',
    gradient: null, // special card
  },
];

export default function ProblemSection() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section
      ref={ref}
      id="platform"
      className="relative py-32 px-6 overflow-hidden"
      style={{ background: 'linear-gradient(to bottom, #ffffff, #F8F9FF)' }}
    >
      <div className="lp-sep absolute inset-x-0 top-0" />

      {/* Soft bg accent */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse 60% 50% at 80% 20%, rgba(183,148,246,0.07) 0%, transparent 60%)' }} />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-20"
        >
          <p className="lp-label mb-4">The problem</p>
          <h2
            className="font-display font-bold leading-tight mb-6"
            style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)', color: '#1A1A2E' }}
          >
            AI companies train on your content.
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #FF9A76, #B794F6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              You earn zero.
            </span>
          </h2>
          <p className="text-xl font-light max-w-2xl mx-auto leading-relaxed" style={{ color: '#4A4A6A' }}>
            GPTBot, ClaudeBot, Bytespider — crawling billions of pages daily.
            Your robots.txt is politely ignored. Your server bill isn&apos;t.
          </p>
        </motion.div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STATS.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1 + 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className={`rounded-3xl p-10 text-center border shadow-lg ${
                i === 2 ? '' : 'bg-white'
              }`}
              style={i === 2 ? {
                background: 'linear-gradient(135deg, rgba(255,154,118,0.08), rgba(183,148,246,0.08))',
                borderColor: 'rgba(255,154,118,0.25)',
              } : {
                borderColor: 'rgba(26,26,46,0.08)',
              }}
            >
              <p
                className="font-display font-bold mb-4 leading-none"
                style={{
                  fontSize: 'clamp(3rem,6vw,4.5rem)',
                  ...(s.gradient ? {
                    background: s.gradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  } : { color: '#1A1A2E' }),
                }}
              >
                {s.value}
              </p>
              <p className="font-semibold mb-2" style={{ color: '#1A1A2E' }}>{s.label}</p>
              <p className="text-sm" style={{ color: i === 2 ? '#4A4A6A' : '#8A8AA8' }}>{s.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Quote */}
        <motion.blockquote
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5 }}
          className="mt-20 max-w-3xl mx-auto text-center"
        >
          <p
            className="text-xl md:text-2xl font-light italic leading-relaxed"
            style={{ color: '#4A4A6A' }}
          >
            &ldquo;400k bot requests a day. Zero cents in revenue.
            ScraperKast changed that in an afternoon.&rdquo;
          </p>
          <footer className="mt-4 text-sm font-semibold" style={{ color: '#1A1A2E' }}>
            Marcus Chen · Founder, DataWeekly.io
          </footer>
        </motion.blockquote>
      </div>
    </section>
  );
}
