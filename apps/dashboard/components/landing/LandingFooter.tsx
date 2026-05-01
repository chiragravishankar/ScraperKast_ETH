import Link from 'next/link';

const LINKS = {
  Platform:  [
    { label: 'Features',   href: '#features' },
    { label: 'Pricing',    href: '#pricing'  },
    { label: 'Dashboard',  href: '/dashboard'},
  ],
  Resources: [
    { label: 'Documentation', href: 'https://docs.scraperkast.com' },
    { label: 'GitHub',         href: 'https://github.com/scraperkast' },
    { label: 'API Reference',  href: '/api'  },
  ],
  Company: [
    { label: 'Twitter',  href: 'https://twitter.com/scraperkast'  },
    { label: 'Contact',  href: 'mailto:hello@scraperkast.com'     },
    { label: 'Privacy',  href: '/privacy'                          },
  ],
};

export default function LandingFooter() {
  return (
    <footer className="border-t bg-white" style={{ borderColor: 'rgba(26,26,46,0.08)' }}>
      <div className="max-w-7xl mx-auto px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div>
            <Link href="/" className="inline-block font-display font-bold text-2xl mb-4 tracking-tight">
              <span style={{ color: '#1A1A2E' }}>Scraper</span>
              <span style={{
                background: 'linear-gradient(135deg, #FF9A76, #B794F6)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                Kast
              </span>
            </Link>
            <p className="text-sm leading-relaxed" style={{ color: '#8A8AA8' }}>
              Payment infrastructure for AI content monetization.
              Built on Ethereum · Base Sepolia.
            </p>
            <div className="flex items-center gap-2 mt-5">
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#4ADE80' }} />
              <span className="text-xs" style={{ color: '#8A8AA8' }}>All systems operational</span>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([title, items]) => (
            <div key={title}>
              <p className="font-semibold text-sm mb-4" style={{ color: '#1A1A2E' }}>{title}</p>
              <ul className="space-y-2.5">
                {items.map(item => (
                  <li key={item.label}>
                    <a
                      href={item.href}
                      className="text-sm transition-colors"
                      style={{ color: '#8A8AA8' }}
                      onMouseEnter={e => { (e.target as HTMLElement).style.color = '#1A1A2E'; }}
                      onMouseLeave={e => { (e.target as HTMLElement).style.color = '#8A8AA8'; }}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t"
          style={{ borderColor: 'rgba(26,26,46,0.07)' }}
        >
          <p className="text-xs" style={{ color: '#8A8AA8' }}>
            © 2026 ScraperKast. Open source.
          </p>
          <p className="text-xs" style={{ color: '#8A8AA8' }}>
            Built with Ethereum · USDC · Next.js · x402
          </p>
        </div>
      </div>
    </footer>
  );
}
