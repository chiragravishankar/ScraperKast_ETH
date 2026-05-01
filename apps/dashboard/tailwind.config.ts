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
        // ── Dashboard semantic tokens (TollBit / Vercel aesthetic) ────
        canvas:  '#FAF9F7',
        surface: '#FFFFFF',
        ink: {
          DEFAULT: '#1A1A1A',
          2:       '#6B6B6B',
          3:       '#9CA3AF',
        },
        edge: {
          DEFAULT: '#E5E5E5',
          2:       '#F0EFED',
        },
        accent: {
          DEFAULT: '#FF5722',
          hover:   '#E64A19',
          muted:   '#FFF3F0',
        },
        // ── Landing page — dark / futuristic tokens ────────────────────
        void:    '#0A0A0A',       // deep black background
        'dark-surface': {
          DEFAULT: '#141414',     // elevated surfaces
          2:       '#1E1E1E',     // cards / modals
          3:       '#252525',     // hover states
        },
        neon: {
          DEFAULT: '#00F0FF',     // cyan neon accent
          dim:     'rgba(0,240,255,0.15)',
          glow:    'rgba(0,240,255,0.5)',
        },
        magenta: {
          DEFAULT: '#FF006E',     // magenta accent
          dim:     'rgba(255,0,110,0.15)',
        },
      },
      fontFamily: {
        sans:    ['var(--font-inter)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['var(--font-outfit)', 'Inter', 'sans-serif'],
        space:   ['var(--font-space)', 'Inter', 'sans-serif'],
        mono:    ['"Fira Code"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
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
