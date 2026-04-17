import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── Brand / accent ─────────────────────────────────────────────
        brand: {
          dark:  '#028090',
          mid:   '#00A896',
          light: '#02C39A',
        },
        // ── New semantic tokens (TollBit / Vercel aesthetic) ───────────
        canvas:  '#FAF9F7',      // warm cream page background
        surface: '#FFFFFF',      // card / panel background
        ink: {
          DEFAULT: '#1A1A1A',    // primary text
          2:       '#6B6B6B',    // secondary text
          3:       '#9CA3AF',    // placeholder / disabled
        },
        edge: {
          DEFAULT: '#E5E5E5',    // standard border
          2:       '#F0EFED',    // subtle divider
        },
        accent: {
          DEFAULT: '#FF5722',    // CTA orange-red
          hover:   '#E64A19',
          muted:   '#FFF3F0',    // light tint for hover/active states
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['"Fira Code"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '16px' }],
      },
      borderRadius: {
        '2xl': '12px',
        '3xl': '16px',
      },
      boxShadow: {
        card:       '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)',
        'popover':  '0 8px 24px rgba(0,0,0,0.12)',
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out both',
        'slide-up':   'slideUp 0.3s ease-out both',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'skeleton':   'skeleton 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' },                              to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseSoft: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.5' } },
        skeleton:  { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
      },
    },
  },
  plugins: [],
};

export default config;
