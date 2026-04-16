import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ScraperKast Dashboard',
  description: 'Monitor bot activity, revenue, and payments for your ScraperKast-protected sites.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
