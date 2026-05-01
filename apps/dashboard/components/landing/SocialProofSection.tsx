'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const TESTIMONIALS = [
  {
    quote:   "We added ScraperKast on a Sunday afternoon. By Monday morning we had $43 in our wallet. $310 by the end of the week. It's passive income for content we were already publishing.",
    name:    'Sarah K.',
    role:    'Founder · TechPulse Weekly',
    avatar:  'SK',
    revenue: '$310/week',
    accent:  '#FF9A76',
  },
  {
    quote:   "Our site gets crushed by AI crawlers. After robots.txt did nothing, ScraperKast was the only practical solution. Now we actually want the bot traffic.",
    name:    'Dmitri V.',
    role:    'CTO · DataLens Media',
    avatar:  'DV',
    revenue: '$1.24k/mo',
    accent:  '#B794F6',
  },
  {
    quote:   "The 5-minute setup claim is real. One import, one config object. Our editorial team couldn't believe we were earning from GPTBot within the hour.",
    name:    'Priya M.',
    role:    'Head of Product · Insightful',
    avatar:  'PM',
    revenue: '$87/day',
    accent:  '#7BA7FF',
  },
  {
    quote:   "Finally a solution that treats bot monetization as a first-class problem. The analytics dashboard shows me exactly which AI companies are visiting in real time.",
    name:    'James O.',
    role:    'Independent Publisher',
    avatar:  'JO',
    revenue: '$520/mo',
    accent:  '#FF9A76',
  },
  {
    quote:   "The on-chain payments are real — USDC lands in my Phantom wallet, and I can withdraw to my bank any time. Complete transparency.",
    name:    'Mia C.',
    role:    'Editor · MarketMind.io',
    avatar:  'MC',
    revenue: '$230/mo',
    accent:  '#B794F6',
  },
  {
    quote:   "I charge OpenAI 3x what I charge smaller crawlers, and every single transaction is visible on-chain. The granular pricing rules are game-changing.",
    name:    'Robert A.',
    role:    'Co-founder · Veritas Data',
    avatar:  'RA',
    revenue: '$3.1k/mo',
    accent:  '#7BA7FF',
  },
];

const AGGREGATE = [
  { value:'500+',   label:'Publishers',   accent:'#FF9A76' },
  { value:'$2.1M',  label:'Paid out',     accent:'#B794F6' },
  { value:'4.9/5',  label:'Rating',       accent:'#7BA7FF' },
  { value:'99.97%', label:'API uptime',   accent:'#FF9A76' },
];

export default function SocialProofSection() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once:true, margin:'-60px' });

  return (
    <section ref={ref} className="relative py-28 px-6 overflow-hidden" style={{ background:'#FFFFFF' }}>
      <div className="lp-sep absolute inset-x-0 top-0" />

      {/* Bg accent */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background:'radial-gradient(ellipse 60% 40% at 90% 10%, rgba(183,148,246,0.07) 0%, transparent 55%)' }} />

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity:0, y:16 }} animate={inView?{opacity:1,y:0}:{}} transition={{ duration:0.5 }}
                    className="text-center mb-14">
          <p className="lp-label mb-3">Social proof</p>
          <h2 className="font-bold tracking-tight" style={{ fontSize:'clamp(2rem,4.5vw,3.5rem)', color:'#1A1A2E' }}>
            Publishers are <span className="lp-gradient-text">earning today</span>
          </h2>
        </motion.div>

        {/* Aggregate stats */}
        <motion.div
          initial={{ opacity:0, y:16 }}
          animate={inView?{opacity:1,y:0}:{}}
          transition={{ delay:0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-14"
        >
          {AGGREGATE.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity:0, y:20 }}
              animate={inView?{opacity:1,y:0}:{}}
              transition={{ delay:0.05*i+0.1, duration:0.5 }}
              className="lp-card text-center p-6">
              <p className="text-4xl font-bold" style={{ color:s.accent }}>{s.value}</p>
              <p className="text-sm mt-1.5" style={{ color:'#4A4A6A' }}>{s.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Masonry testimonials */}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity:0, y:20 }}
              animate={inView?{opacity:1,y:0}:{}}
              transition={{ delay:0.08 + i*0.07, duration:0.5, ease:[0.16,1,0.3,1] }}
              whileHover={{ y:-4, boxShadow:`0 16px 36px ${t.accent}14` }}
              className="break-inside-avoid lp-card p-6 cursor-default"
              style={{ transition:'all 0.25s ease' }}
            >
              {/* Accent top line */}
              <div className="w-8 h-0.5 rounded-full mb-4" style={{ background:t.accent }} />

              {/* Quote */}
              <p className="text-sm leading-relaxed" style={{ color:'#4A4A6A' }}>
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Footer */}
              <div className="flex items-center justify-between mt-5 pt-4 border-t"
                   style={{ borderColor:'rgba(26,26,46,0.06)' }}>
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background:`${t.accent}18`, color:t.accent, border:`1px solid ${t.accent}30` }}
                  >
                    {t.avatar}
                  </span>
                  <div>
                    <p className="text-xs font-semibold" style={{ color:'#1A1A2E' }}>{t.name}</p>
                    <p className="text-xs mt-0.5" style={{ color:'#8A8AA8' }}>{t.role}</p>
                  </div>
                </div>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0"
                  style={{ color:t.accent, borderColor:`${t.accent}30`, background:`${t.accent}0D` }}
                >
                  {t.revenue}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
