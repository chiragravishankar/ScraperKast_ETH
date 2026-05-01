'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';

const BENEFITS = [
  '100% revenue to you',
  'Zero setup fees',
  'Live in 5 minutes',
  'Cancel anytime',
];

export default function CtaSection() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative py-32 px-6 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0"
           style={{ background: 'linear-gradient(135deg, #FFF5F0 0%, #FFFFFF 45%, #F8F0FF 100%)' }} />

      {/* Ambient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-3xl"
             style={{ background: 'radial-gradient(circle, rgba(255,154,118,0.15) 0%, transparent 65%)' }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full blur-3xl"
             style={{ background: 'radial-gradient(circle, rgba(183,148,246,0.12) 0%, transparent 65%)' }} />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center">
        {/* Label */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5 }}
          className="lp-label mb-5"
        >
          Get started
        </motion.p>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.07, duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="font-display font-bold leading-tight mb-8"
          style={{ fontSize: 'clamp(2.5rem, 7vw, 5.5rem)', color: '#1A1A2E' }}
        >
          Ready to turn scrapers{' '}
          <br className="hidden md:block" />
          into{' '}
          <span style={{
            background: 'linear-gradient(135deg, #FF9A76, #B794F6, #7BA7FF)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            revenue?
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.2 }}
          className="text-xl font-light max-w-xl mx-auto mb-10 leading-relaxed"
          style={{ color: '#4A4A6A' }}
        >
          One line of code. Five minutes to deploy. Start earning today.
        </motion.p>

        {/* Benefit chips */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3 }}
          className="flex flex-wrap justify-center gap-3 mb-12"
        >
          {BENEFITS.map((b, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full border text-sm font-medium"
              style={{ background: 'rgba(255,255,255,0.75)', borderColor: 'rgba(26,26,46,0.1)', color: '#4A4A6A', backdropFilter: 'blur(12px)' }}
            >
              <span style={{ color: '#FF9A76' }}>✓</span>
              {b}
            </div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.42 }}
        >
          <Link
            href="/dashboard"
            className="group inline-flex items-center gap-2 px-12 py-5 rounded-xl font-bold text-xl text-white shadow-2xl hover:scale-[1.04] transition-all"
            style={{ background: 'linear-gradient(135deg, #FF9A76, #B794F6)', boxShadow: '0 8px 32px rgba(255,154,118,0.35)' }}
          >
            Start earning free
            <span className="group-hover:translate-x-2 inline-block transition-transform">→</span>
          </Link>

          <p className="mt-5 text-sm" style={{ color: '#8A8AA8' }}>
            No credit card required · Open source
          </p>
        </motion.div>

      </div>
    </section>
  );
}
