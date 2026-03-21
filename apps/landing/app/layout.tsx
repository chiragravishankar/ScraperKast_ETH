import type { Metadata, Viewport } from 'next';
import './globals.css';

// ── SEO & social metadata ─────────────────────────────────────────────────────
// Edit these without touching layout structure.

const SITE_URL  = 'https://scraperkast.com';
const SITE_NAME = 'ScraperKast';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default: 'ScraperKast — Open Source AI Content Monetization',
    template: '%s | ScraperKast',
  },
  description:
    'Charge AI companies for content access. Express middleware with 5% commission on managed cloud. ' +
    'MIT licensed, self-host for free. Detects 18 AI bots including GPTBot, Claude, and Perplexity.',

  keywords: [
    'ai', 'bot', 'paywall', 'monetization', 'express', 'middleware',
    'open source', 'tollbit', 'gptbot', 'content protection',
  ],

  authors: [{ name: 'Chirag Ravishankar', url: SITE_URL }],
  creator: 'Chirag Ravishankar',

  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'ScraperKast — Open Source AI Content Monetization',
    description:
      'Charge AI companies for content access. MIT licensed Express middleware. ' +
      'Self-host for free or pay 5% commission on managed cloud.',
    locale: 'en_US',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'ScraperKast — Open Source AI Content Monetization',
    description:
      'Charge AI companies for content access. MIT licensed. Self-host for free.',
    creator: '@chiragravishankar',
  },

  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

export const viewport: Viewport = {
  themeColor: '#028090',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
