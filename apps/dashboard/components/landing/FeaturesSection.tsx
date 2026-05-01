'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const FEATURES = [
  {
    icon:  '⚡',
    title: 'Instant settlement',
    desc:  'USDC transfers settle on Base Sepolia in ~2s via x402. Your revenue appears before the bot finishes reading. No NET-30. No invoicing. No waiting.',
    gradient: 'linear-gradient(135deg, #FF9A76, #FFB3D9)',
    accent: '#FF9A76',
  },
  {
    icon:  '🔒',
    title: 'Zero trust required',
    desc:  'Every payment is verified on-chain. Public, immutable, auditable by anyone. No chargebacks, no disputes, no counterparty risk.',
    gradient: 'linear-gradient(135deg, #7BA7FF, #B794F6)',
    accent: '#7BA7FF',
  },
  {
    icon:  '🎯',
    title: 'Granular control',
    desc:  'Set prices per bot, per path, per file type. $0.001 for HTML, $0.01 for APIs, $0.05 for PDFs. Charge OpenAI 3× what you charge others.',
    gradient: 'linear-gradient(135deg, #B794F6, #FFB3D9)',
    accent: '#B794F6',
  },
  {
    icon:  '📊',
    title: 'Real-time analytics',
    desc:  'Watch USDC arrive per-request. Revenue by bot, by page, by hour. Every transaction on-chain. Every metric in your dashboard.',
    gradient: 'linear-gradient(135deg, #FFB3D9, #FF9A76)',
    accent: '#FFB3D9',
  },
  {
    icon:  '💎',
    title: 'Platform wallet',
    desc:  'Configure your own Ethereum wallet as recipient. Payments arrive directly — no custodian, no lockups, no intermediaries.',
    gradient: 'linear-gradient(135deg, #FF9A76, #7BA7FF)',
    accent: '#FF9A76',
  },
  {
    icon:  '🚀',
    title: 'One-line deployment',
    desc:  'Add one import. Deploy. Start earning. Works with Next.js, Express, Fastify, Cloudflare Workers, Vercel Edge, and AWS Lambda.',
    gradient: 'linear-gradient(135deg, #7BA7FF, #FF9A76)',
    accent: '#7BA7FF',
  },
];

export default function FeaturesSection() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section id="features" className="relative py-32 px-6 overflow-hidden"
             style={{ background: '#FFFFFF' }}>
      <div className="lp-sep absolute inset-x-0 top-0" />

      {/* Bg accent */}
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(ellipse 50% 40% at 10% 60%, rgba(255,154,118,0.06) 0%, transparent 55%)' }} />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-20"
        >
          <p className="lp-label mb-4">Features</p>
          <h2
            className="font-display font-bold mb-6"
            style={{ fontSize: 'clamp(2.5rem, 5.5vw, 5rem)', color: '#1A1A2E' }}
          >
            Everything you need to{' '}
            <span style={{
              background: 'linear-gradient(135deg, #FF9A76, #B794F6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              monetize bots
            </span>
          </h2>
          <p className="text-xl font-light max-w-2xl mx-auto" style={{ color: '#4A4A6A' }}>
            Production-ready infrastructure. Zero maintenance. 100% uptime SLA.
          </p>
        </motion.div>

        {/* Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          initial="hidden"
          animate={inView ? 'visible' : 'hidden'}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.09 } } }}
        >
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } } }}
              whileHover={{ y: -8 }}
              className="group relative p-8 rounded-3xl bg-white border shadow-lg hover:shadow-2xl transition-all cursor-default overflow-hidden"
              style={{ borderColor: 'rgba(26,26,46,0.08)' }}
            >
              {/* Icon */}
              <div className="text-5xl mb-5">{f.icon}</div>

              {/* Title */}
              <h3 className="font-display font-bold text-2xl mb-3" style={{ color: '#1A1A2E' }}>
                {f.title}
              </h3>

              {/* Desc */}
              <p className="text-sm leading-relaxed" style={{ color: '#4A4A6A' }}>
                {f.desc}
              </p>

              {/* Hover gradient underline */}
              <div
                className="absolute bottom-0 left-0 h-0.5 w-0 group-hover:w-full transition-all duration-500 rounded-full"
                style={{ background: f.gradient }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
