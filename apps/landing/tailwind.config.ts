import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // ScraperKast ocean teal palette — edit these to rebrand
        brand: {
          dark:  '#028090',   // dark teal  — primary text/buttons
          mid:   '#00A896',   // mid teal   — hover states
          light: '#02C39A',   // bright teal — accents / gradient end
        },
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
