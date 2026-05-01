'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';

const FLOW_STEPS = [
  {
    id: '01',
    side: 'left' as const,
    accent: '#FF9A76',
    label: 'Bot makes request',
    desc:  'GPTBot hits your /blog/ai-trends page. ScraperKast identifies it in <1ms.',
    gradient: 'linear-gradient(135deg, #FF9A76, #FFB3D9)',
  },
  {
    id: '02',
    side: 'right' as const,
    accent: '#B794F6',
    label: 'We issue a payment challenge',
    desc:  '402 Payment Required: 1,050 µUSDC ($0.00105). You set the base rate; we charge bots a 5% surcharge on top.',
    sub:   'You set: $0.001 base + $0.0005 GPTBot markup',
    gradient: 'linear-gradient(135deg, #B794F6, #7BA7FF)',
  },
  {
    id: '03',
    side: 'left' as const,
    accent: '#7BA7FF',
    label: 'Bot pays via x402',
    desc:  'USDC transfer verified on Base Sepolia in ~2s. Permanent, public, unforgeable.',
    gradient: 'linear-gradient(135deg, #7BA7FF, #FFB3D9)',
  },
  {
    id: '04',
    side: 'right' as const,
    accent: '#FF9A76',
    label: 'You keep 100%',
    desc:  '$0.00105 lands in your wallet instantly. Our fee comes from the 5% bot surcharge — not from you.',
    sub:   'Your cost: $0. Always.',
    gradient: 'linear-gradient(135deg, #FF9A76, #B794F6)',
    highlight: true,
  },
];

const PRICE_TYPES = [
  {
    icon:  '$',
    title: 'Base price',
    desc:  '$0.0001 – $0.01 per request',
    gradient: 'linear-gradient(135deg, #FF9A76, #FFB3D9)',
  },
  {
    icon:  '🤖',
    title: 'Per-bot markup',
    desc:  'Charge GPT 3× more. Your rules.',
    gradient: 'linear-gradient(135deg, #B794F6, #7BA7FF)',
  },
  {
    icon:  '📄',
    title: 'Per-path pricing',
    desc:  'HTML cheap. PDFs and APIs premium.',
    gradient: 'linear-gradient(135deg, #7BA7FF, #FFB3D9)',
  },
];

export default function PricingSection() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="pricing" ref={ref}
             className="relative py-32 px-6 overflow-hidden"
             style={{ background: 'linear-gradient(to bottom, #F8F9FF, #FFFFFF)' }}>
      <div className="lp-sep absolute inset-x-0 top-0" />

      {/* Bg accent */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse 55% 45% at 50% 80%, rgba(123,167,255,0.06) 0%, transparent 60%)' }} />

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-20"
        >
          <p className="lp-label mb-4">Pricing</p>
          <h2
            className="font-display font-bold mb-6"
            style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5rem)', color: '#1A1A2E' }}
          >
            Simple, transparent,{' '}
            <span style={{
              background: 'linear-gradient(135deg, #FF9A76, #B794F6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              fair
            </span>
          </h2>
          <p className="text-xl font-light max-w-xl mx-auto" style={{ color: '#4A4A6A' }}>
            We charge the bots. You keep 100%. That&apos;s it.
          </p>
        </motion.div>

        {/* Flow */}
        <div className="relative max-w-4xl mx-auto">
          {/* Centre line */}
          <div
            className="absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-px hidden md:block"
            style={{ background: 'linear-gradient(to bottom, #FF9A76, #B794F6, #7BA7FF, #FF9A76)' }}
          />

          <div className="space-y-10">
            {FLOW_STEPS.map((s, i) => {
              const isLeft = s.side === 'left';
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: isLeft ? -40 : 40 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ delay: i * 0.12 + 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="relative flex items-center gap-0 md:gap-8"
                >
                  {/* Left slot */}
                  <div className={`flex-1 ${isLeft ? 'md:text-right' : 'hidden md:block'}`}>
                    {isLeft && (
                      <div
                        className={`inline-block p-7 rounded-2xl border shadow-lg ${s.highlight ? '' : 'bg-white'}`}
                        style={s.highlight ? {
                          background: 'linear-gradient(135deg, rgba(255,154,118,0.08), rgba(183,148,246,0.08))',
                          borderColor: 'rgba(255,154,118,0.25)',
                        } : { borderColor: 'rgba(26,26,46,0.08)' }}
                      >
                        <StepCard s={s} />
                      </div>
                    )}
                  </div>

                  {/* Centre badge */}
                  <div
                    className="relative z-10 w-12 h-12 rounded-full flex items-center justify-center font-display font-bold text-white shadow-lg shrink-0"
                    style={{ background: s.gradient }}
                  >
                    {s.id}
                  </div>

                  {/* Right slot */}
                  <div className={`flex-1 ${!isLeft ? '' : 'hidden md:block'}`}>
                    {!isLeft && (
                      <div
                        className={`inline-block p-7 rounded-2xl border shadow-lg ${s.highlight ? '' : 'bg-white'}`}
                        style={s.highlight ? {
                          background: 'linear-gradient(135deg, rgba(255,154,118,0.08), rgba(183,148,246,0.08))',
                          borderColor: 'rgba(255,154,118,0.25)',
                        } : { borderColor: 'rgba(26,26,46,0.08)' }}
                      >
                        <StepCard s={s} />
                      </div>
                    )}

                    {/* Mobile: show all on right */}
                    {isLeft && (
                      <div className="md:hidden">
                        <div
                          className={`p-7 rounded-2xl border shadow-lg ${s.highlight ? '' : 'bg-white'}`}
                          style={s.highlight ? {
                            background: 'linear-gradient(135deg, rgba(255,154,118,0.08), rgba(183,148,246,0.08))',
                            borderColor: 'rgba(255,154,118,0.25)',
                          } : { borderColor: 'rgba(26,26,46,0.08)' }}
                        >
                          <StepCard s={s} />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Pricing levers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6 }}
          className="mt-24 p-10 rounded-3xl border bg-white shadow-lg"
          style={{ borderColor: 'rgba(26,26,46,0.08)' }}
        >
          <h3
            className="font-display font-bold text-2xl mb-2 text-center"
            style={{ color: '#1A1A2E' }}
          >
            How you set prices
          </h3>
          <p className="text-center text-sm mb-10" style={{ color: '#8A8AA8' }}>
            Full control. No surprises. Change anytime.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PRICE_TYPES.map((p, i) => (
              <div key={i} className="text-center">
                <div
                  className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white text-2xl font-bold shadow-lg"
                  style={{ background: p.gradient }}
                >
                  {p.icon}
                </div>
                <h4 className="font-semibold mb-1.5" style={{ color: '#1A1A2E' }}>{p.title}</h4>
                <p className="text-sm" style={{ color: '#8A8AA8' }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.75 }}
          className="mt-12 text-center"
        >
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white text-lg shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all"
            style={{ background: 'linear-gradient(135deg, #FF9A76, #B794F6)' }}
          >
            Start earning free →
          </Link>
          <p className="mt-4 text-sm" style={{ color: '#8A8AA8' }}>
            Free tier · No credit card · Live in 5 minutes
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function StepCard({ s }: { s: typeof FLOW_STEPS[number] }) {
  return (
    <>
      <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: s.accent }}>
        Step {s.id}
      </div>
      <h3 className="font-display font-bold text-lg mb-2" style={{ color: '#1A1A2E' }}>
        {s.label}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: '#4A4A6A' }}>{s.desc}</p>
      {s.sub && (
        <p className="mt-2 text-xs" style={{ color: '#8A8AA8' }}>{s.sub}</p>
      )}
    </>
  );
}
