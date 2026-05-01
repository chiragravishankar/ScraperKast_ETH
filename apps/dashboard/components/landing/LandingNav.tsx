'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const NAV_LINKS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Features',  href: '#features' },
  { label: 'Pricing',   href: '#pricing'  },
  { label: 'Docs',      href: 'https://docs.scraperkast.com' },
  { label: 'GitHub',    href: 'https://github.com/scraperkast' },
];

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm'
        : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-2xl font-bold font-display tracking-tight">
          <span className="text-gray-900">Scraper</span>
          <span style={{
            background: 'linear-gradient(135deg, #FF9A76, #B794F6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Kast
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(l => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
            >
              {l.label}
            </a>
          ))}
        </div>

        {/* Single CTA */}
        <Link
          href="/dashboard"
          className="px-5 py-2.5 rounded-xl font-semibold text-sm text-white shadow-lg hover:shadow-xl hover:scale-[1.03] transition-all"
          style={{ background: 'linear-gradient(135deg, #FF9A76, #B794F6)' }}
        >
          Launch App →
        </Link>
      </div>
    </nav>
  );
}
