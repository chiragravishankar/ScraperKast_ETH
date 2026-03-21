import CopyButton from './components/CopyButton';
import MobileNav  from './components/MobileNav';
import { FadeIn, StaggerParent, StaggerChild, HoverCard } from './components/Animate';

// ── Constants — edit these to rebrand / update links ─────────────────────────

const NPM_INSTALL = 'npm install @scraperkast/middleware-express';

const GITHUB_URL = 'https://github.com/chiragravishankar/scraperkast';
const DOCS_URL   = 'https://github.com/chiragravishankar/scraperkast/tree/main/docs';
const NPM_URL    = 'https://www.npmjs.com/package/@scraperkast/middleware-express';

// ── Code example content ──────────────────────────────────────────────────────
// Changing this string also updates the "Copy" button target.

const CODE_EXAMPLE = `import { scraperKast } from '@scraperkast/middleware-express';

app.use(scraperKast({
  rules: [
    {
      id: '1',
      path: '/blog/*',
      pricePerPage: 100,       // $0.001 per page
      licenseType: 'summarization',
    },
  ],
  jwtSecret: process.env.JWT_SECRET,
}));`;

// ── Page data ─────────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    step: 1,
    emoji: '📦',
    title: 'Install the middleware',
    description: 'One npm install adds ScraperKast to any Express app. No infrastructure changes required.',
  },
  {
    step: 2,
    emoji: '⚙️',
    title: 'Configure pricing rules',
    description: 'Define prices per path and per bot. Wildcards, per-bot overrides, free tiers — full control.',
  },
  {
    step: 3,
    emoji: '💰',
    title: 'Earn from AI bots',
    description: 'Bots without a paid token get a 402 with a payment URL. Human visitors are never affected.',
  },
];

const FEATURES = [
  { emoji: '🔓', title: 'Open Source',      description: 'MIT licensed. Audit every line, fork it, contribute. No black boxes.' },
  { emoji: '💰', title: 'Fair Pricing',      description: '5% commission on managed cloud, or self-host for completely free.' },
  { emoji: '🌐', title: 'Any Website',       description: 'Blogs, SaaS docs, news sites, e-commerce. If it runs Express, it works.' },
  { emoji: '⚡', title: 'Easy Setup',        description: 'No CDN, no reverse proxy, no DNS changes. Just npm install.' },
  { emoji: '🧑‍💻', title: 'Developer-First', description: 'TypeScript-native, fully typed API, Vitest test suite, comprehensive docs.' },
  { emoji: '🏠', title: 'Self-Hostable',     description: 'Your data never leaves your server. Run it on existing infrastructure.' },
];

const SELF_HOSTED_PERKS = [
  '0% commission',
  'Unlimited requests',
  'Your data, your server',
  'Full source code access',
  'Community support (GitHub)',
];

const CLOUD_PERKS = [
  'First 10,000 requests free',
  '5% of bot revenue collected',
  'Managed payment processing',
  'Analytics dashboard',
  'Priority support',
];

const DETECTED_BOTS = [
  'OpenAI GPTBot', 'ChatGPT-User', 'Anthropic Claude-Web',
  'Perplexity PerplexityBot', 'Google-Extended', 'Cohere cohere-ai',
  'Common Crawl CCBot', 'You.com YouBot', '+ 10 more',
];

// ── Shared icon ───────────────────────────────────────────────────────────────

function GitHubIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8l3.5 3.5L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* ════════════════════════════════════════════════════════════════════
          NAV
      ════════════════════════════════════════════════════════════════════ */}
      <nav className="border-b border-gray-100 bg-white/90 backdrop-blur-md sticky top-0 z-50">
        <div className="container-page flex items-center justify-between h-16">

          <a href="/" className="flex items-center gap-2.5 font-bold text-lg text-brand-dark">
            <span className="text-2xl leading-none">🌊</span>
            ScraperKast
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href={DOCS_URL}   target="_blank" rel="noopener noreferrer"
               className="hover:text-brand-dark transition-colors duration-150">Docs</a>
            <a href={NPM_URL}    target="_blank" rel="noopener noreferrer"
               className="hover:text-brand-dark transition-colors duration-150">npm</a>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer"
               className="flex items-center gap-1.5 bg-gray-900 text-white text-sm font-medium px-4 py-1.5 rounded-full hover:bg-gray-700 transition-colors duration-150">
              <GitHubIcon className="w-4 h-4" />
              Star on GitHub
            </a>
          </div>

          {/* Mobile hamburger — client component */}
          <MobileNav docsUrl={DOCS_URL} npmUrl={NPM_URL} githubUrl={GITHUB_URL} />
        </div>
      </nav>

      {/* ════════════════════════════════════════════════════════════════════
          HERO
      ════════════════════════════════════════════════════════════════════ */}
      <section className="hero-glow">
        <div className="container-page pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">

          <FadeIn delay={0}>
            <div className="inline-flex items-center gap-2 bg-brand-dark/10 text-brand-dark text-sm font-medium px-4 py-1.5 rounded-full mb-8 border border-brand-dark/20">
              <span aria-hidden="true">🚀</span>
              Open-source · MIT licensed · Self-hostable
            </div>
          </FadeIn>

          <FadeIn delay={0.07}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6 max-w-3xl mx-auto">
              Monetize AI Bots.{' '}
              <span className="text-brand-gradient">Keep Your Revenue.</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.14}>
            <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-10 sm:mb-12 leading-relaxed">
              Open-source Express middleware to charge AI companies for content access.
              Self-host for free, or pay just{' '}
              <span className="font-semibold text-gray-700">5% commission</span>{' '}
              on the managed cloud.
            </p>
          </FadeIn>

          {/* CTAs */}
          <FadeIn delay={0.2}>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 max-w-xl mx-auto sm:max-w-none">

              {/* npm install pill */}
              <div className="flex items-center gap-2 sm:gap-3 bg-gray-950 text-gray-100 font-mono text-xs sm:text-sm px-4 sm:px-5 py-3 rounded-xl border border-gray-800 min-w-0">
                <span className="text-brand-light select-none shrink-0">$</span>
                <span className="flex-1 text-left truncate">{NPM_INSTALL}</span>
                <CopyButton
                  text={NPM_INSTALL}
                  label="Copy"
                  successLabel="✓"
                  className="shrink-0 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 px-2.5 py-1 rounded-md transition-colors font-sans cursor-pointer"
                />
              </div>

              {/* GitHub star */}
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 border-2 border-brand-dark text-brand-dark font-semibold px-6 py-3 rounded-xl hover:bg-brand-dark hover:text-white transition-all duration-200 whitespace-nowrap shrink-0"
              >
                <GitHubIcon />
                Star on GitHub
              </a>
            </div>

            <p className="mt-5 text-sm text-gray-400">
              Detects 18 AI bots · Zero overhead for human visitors · TypeScript-native
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-50 py-20 sm:py-24">
        <div className="container-page">

          <FadeIn>
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">How It Works</h2>
            <p className="text-center text-gray-500 mb-12 max-w-xl mx-auto">
              Three steps from zero to earning on every AI bot that crawls your site.
            </p>
          </FadeIn>

          {/* Steps animate in sequentially */}
          <StaggerParent className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {HOW_IT_WORKS.map(({ step, emoji, title, description }) => (
              <StaggerChild key={step}>
                <HoverCard className="relative bg-white rounded-2xl p-7 sm:p-8 border border-gray-100 shadow-sm h-full cursor-default">
                  {/* Step pill */}
                  <div className="absolute -top-3.5 left-7 bg-brand-dark text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                    Step {step}
                  </div>

                  <div className="text-4xl mb-4 mt-1" aria-hidden="true">{emoji}</div>
                  <h3 className="text-base sm:text-lg font-bold mb-2">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
                </HoverCard>
              </StaggerChild>
            ))}
          </StaggerParent>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          CODE EXAMPLE
      ════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-24">
        <div className="container-page">
          <div className="max-w-3xl mx-auto">

            <FadeIn>
              <h2 className="text-2xl sm:text-3xl font-bold mb-3">Five lines of code.</h2>
              <p className="text-gray-500 mb-8 leading-relaxed">
                Mount the middleware before your routes. Human visitors pass through untouched.
                AI bots get a machine-readable{' '}
                <code className="text-sm bg-gray-100 text-brand-dark px-1.5 py-0.5 rounded font-mono">402</code>{' '}
                with a payment URL.
              </p>
            </FadeIn>

            <FadeIn delay={0.08}>
              {/* Code block */}
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-800/60 bg-[#0d1117]">

                {/* Traffic-light bar */}
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 bg-[#161b22] border-b border-gray-700/60">
                  <div className="flex gap-1.5" aria-hidden="true">
                    <span className="w-3 h-3 rounded-full bg-[#ff5f57]"/>
                    <span className="w-3 h-3 rounded-full bg-[#febc2e]"/>
                    <span className="w-3 h-3 rounded-full bg-[#28c840]"/>
                  </div>
                  <span className="text-xs text-gray-500 font-mono">server.ts</span>
                  <CopyButton
                    text={CODE_EXAMPLE}
                    label="Copy"
                    successLabel="✓ Copied"
                    className="text-xs text-gray-400 hover:text-gray-100 bg-gray-700/60 hover:bg-gray-600/80 px-3 py-1 rounded-md transition-colors cursor-pointer font-sans"
                  />
                </div>

                {/* Code area — scrollable on small screens */}
                <div className="overflow-x-auto">
                  <pre className="p-5 sm:p-6 text-[13px] leading-[1.85] min-w-[480px]">
                    <code className="font-mono">
                      {/* Line numbers + code side by side */}
                      <table className="border-collapse w-full">
                        <tbody>
                          {/* Line 1 */}
                          <tr>
                            <td className="tk-linenum pr-5 w-8 align-top text-[11px] leading-[1.85]">1</td>
                            <td>
                              <span className="tk-keyword">import</span>
                              <span className="tk-plain"> {'{ scraperKast } '}</span>
                              <span className="tk-keyword">from</span>
                              <span className="tk-plain"> </span>
                              <span className="tk-string">&apos;@scraperkast/middleware-express&apos;</span>
                              <span className="tk-plain">;</span>
                            </td>
                          </tr>
                          {/* Line 2 — blank */}
                          <tr><td className="tk-linenum pr-5 text-[11px] leading-[1.85]">2</td><td>&nbsp;</td></tr>
                          {/* Line 3 */}
                          <tr>
                            <td className="tk-linenum pr-5 text-[11px] leading-[1.85]">3</td>
                            <td><span className="tk-plain">app.use(scraperKast({'{'}</span></td>
                          </tr>
                          {/* Line 4 */}
                          <tr>
                            <td className="tk-linenum pr-5 text-[11px] leading-[1.85]">4</td>
                            <td>
                              <span className="tk-plain">{'  '}</span>
                              <span className="tk-prop">rules</span>
                              <span className="tk-plain">: [</span>
                            </td>
                          </tr>
                          {/* Line 5 */}
                          <tr>
                            <td className="tk-linenum pr-5 text-[11px] leading-[1.85]">5</td>
                            <td><span className="tk-plain">{'    {'}</span></td>
                          </tr>
                          {/* Line 6 */}
                          <tr>
                            <td className="tk-linenum pr-5 text-[11px] leading-[1.85]">6</td>
                            <td>
                              <span className="tk-plain">{'      '}</span>
                              <span className="tk-prop">id</span>
                              <span className="tk-plain">: </span>
                              <span className="tk-string">&apos;1&apos;</span>
                              <span className="tk-plain">,</span>
                            </td>
                          </tr>
                          {/* Line 7 */}
                          <tr>
                            <td className="tk-linenum pr-5 text-[11px] leading-[1.85]">7</td>
                            <td>
                              <span className="tk-plain">{'      '}</span>
                              <span className="tk-prop">path</span>
                              <span className="tk-plain">: </span>
                              <span className="tk-string">&apos;/blog/*&apos;</span>
                              <span className="tk-plain">,</span>
                            </td>
                          </tr>
                          {/* Line 8 */}
                          <tr>
                            <td className="tk-linenum pr-5 text-[11px] leading-[1.85]">8</td>
                            <td>
                              <span className="tk-plain">{'      '}</span>
                              <span className="tk-prop">pricePerPage</span>
                              <span className="tk-plain">: </span>
                              <span className="tk-number">100</span>
                              <span className="tk-plain">,</span>
                              <span className="tk-comment">{'       '}{'// $0.001 per page'}</span>
                            </td>
                          </tr>
                          {/* Line 9 */}
                          <tr>
                            <td className="tk-linenum pr-5 text-[11px] leading-[1.85]">9</td>
                            <td>
                              <span className="tk-plain">{'      '}</span>
                              <span className="tk-prop">licenseType</span>
                              <span className="tk-plain">: </span>
                              <span className="tk-string">&apos;summarization&apos;</span>
                              <span className="tk-plain">,</span>
                            </td>
                          </tr>
                          {/* Line 10 */}
                          <tr>
                            <td className="tk-linenum pr-5 text-[11px] leading-[1.85]">10</td>
                            <td><span className="tk-plain">{'    },'}</span></td>
                          </tr>
                          {/* Line 11 */}
                          <tr>
                            <td className="tk-linenum pr-5 text-[11px] leading-[1.85]">11</td>
                            <td><span className="tk-plain">{'  ],'}</span></td>
                          </tr>
                          {/* Line 12 */}
                          <tr>
                            <td className="tk-linenum pr-5 text-[11px] leading-[1.85]">12</td>
                            <td>
                              <span className="tk-plain">{'  '}</span>
                              <span className="tk-prop">jwtSecret</span>
                              <span className="tk-plain">: process.env.</span>
                              <span className="tk-prop">JWT_SECRET</span>
                              <span className="tk-plain">,</span>
                            </td>
                          </tr>
                          {/* Line 13 */}
                          <tr>
                            <td className="tk-linenum pr-5 text-[11px] leading-[1.85]">13</td>
                            <td><span className="tk-plain">{'} ));'}</span></td>
                          </tr>
                        </tbody>
                      </table>
                    </code>
                  </pre>
                </div>
              </div>

              {/* Links below */}
              <div className="flex flex-wrap gap-4 sm:gap-6 mt-5 text-sm">
                <a href={DOCS_URL} target="_blank" rel="noopener noreferrer"
                   className="text-brand-dark hover:underline font-medium transition-colors">
                  View full docs →
                </a>
                <a href={`${GITHUB_URL}/tree/main/examples/express-demo`} target="_blank" rel="noopener noreferrer"
                   className="text-gray-400 hover:text-brand-dark hover:underline transition-colors">
                  See demo app →
                </a>
              </div>
            </FadeIn>

          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          DETECTED BOTS STRIP
      ════════════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-50 py-10">
        <div className="container-page">
          <FadeIn>
            <p className="text-center text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">
              Detects and gates these bots automatically
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {DETECTED_BOTS.map((bot) => (
                <span
                  key={bot}
                  className="bg-white border border-gray-200 text-gray-600 text-xs font-mono px-3 py-1.5 rounded-full shadow-sm"
                >
                  {bot}
                </span>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          FEATURES
      ════════════════════════════════════════════════════════════════════ */}
      <section className="py-20 sm:py-24">
        <div className="container-page">

          <FadeIn>
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">
              Everything you need. Nothing you don&apos;t.
            </h2>
            <p className="text-center text-gray-500 mb-12 max-w-xl mx-auto">
              Built for developers who want to own their monetization layer, not rent it from a SaaS.
            </p>
          </FadeIn>

          {/* 1 col mobile, 2 col tablet, 3 col desktop */}
          <StaggerParent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {FEATURES.map(({ emoji, title, description }) => (
              <StaggerChild key={title}>
                <HoverCard className="flex gap-4 p-5 sm:p-6 rounded-2xl border border-gray-100 bg-white shadow-sm cursor-default h-full">
                  <div className="text-3xl shrink-0 mt-0.5" aria-hidden="true">{emoji}</div>
                  <div>
                    <h3 className="font-bold mb-1.5">{title}</h3>
                    <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
                  </div>
                </HoverCard>
              </StaggerChild>
            ))}
          </StaggerParent>

        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          PRICING
      ════════════════════════════════════════════════════════════════════ */}
      <section className="bg-gray-50 py-20 sm:py-24" id="pricing">
        <div className="container-page">

          <FadeIn>
            <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Pricing</h2>
            <p className="text-center text-gray-500 mb-12">
              Simple. No monthly fee. No seat licenses.
            </p>
          </FadeIn>

          {/* Stack on mobile, side-by-side on md+ */}
          <StaggerParent className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 max-w-3xl mx-auto">

            {/* Self-Hosted */}
            <StaggerChild>
              <HoverCard className="bg-white rounded-2xl border-2 border-gray-200 p-7 sm:p-8 h-full flex flex-col cursor-default">
                <div>
                  <div className="text-2xl mb-3" aria-hidden="true">🏠</div>
                  <h3 className="text-xl font-bold mb-1">Self-Hosted</h3>
                  <p className="text-gray-500 text-sm mb-6">
                    Run everything on your own server. Full control, zero cost.
                  </p>

                  <div className="mb-6">
                    <span className="text-5xl font-extrabold text-gray-900">$0</span>
                    <span className="text-gray-400 ml-2 text-sm">/ forever</span>
                  </div>

                  <ul className="space-y-2.5 text-sm mb-8">
                    {SELF_HOSTED_PERKS.map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-gray-700">
                        <span className="text-brand-light"><CheckIcon /></span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto block text-center border-2 border-brand-dark text-brand-dark font-semibold py-3 rounded-xl hover:bg-brand-dark hover:text-white transition-all duration-200"
                >
                  Read the docs
                </a>
              </HoverCard>
            </StaggerChild>

            {/* Cloud */}
            <StaggerChild>
              <HoverCard className="bg-brand-dark rounded-2xl border-2 border-brand-dark p-7 sm:p-8 text-white relative overflow-hidden h-full flex flex-col cursor-default">
                {/* Gradient shimmer */}
                <div className="absolute inset-0 bg-gradient-to-br from-brand-mid/25 to-brand-light/15 pointer-events-none" aria-hidden="true"/>

                <div className="relative flex flex-col h-full">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl" aria-hidden="true">☁️</span>
                      <span className="bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                        Coming soon
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-1">Cloud</h3>
                    <p className="text-white/70 text-sm mb-6">
                      Managed hosting, analytics dashboard, Stripe payments handled for you.
                    </p>

                    <div className="mb-6">
                      <span className="text-5xl font-extrabold">5%</span>
                      <span className="text-white/60 ml-2 text-sm">commission</span>
                    </div>

                    <ul className="space-y-2.5 text-sm mb-8">
                      {CLOUD_PERKS.map((item) => (
                        <li key={item} className="flex items-center gap-2.5 text-white/90">
                          <span className="text-brand-light"><CheckIcon /></span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <a
                    href={`${GITHUB_URL}/discussions`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto block text-center bg-white text-brand-dark font-semibold py-3 rounded-xl hover:bg-brand-light hover:text-white transition-all duration-200"
                  >
                    Join the waitlist
                  </a>
                </div>
              </HoverCard>
            </StaggerChild>

          </StaggerParent>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          FINAL CTA
      ════════════════════════════════════════════════════════════════════ */}
      <section className="py-24 sm:py-32">
        <div className="container-page text-center">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold mb-5 max-w-xl mx-auto leading-tight">
              Get Started in{' '}
              <span className="text-brand-gradient">5 Minutes</span>
            </h2>

            <p className="text-gray-500 text-lg mb-10 max-w-md mx-auto">
              One npm install and three pricing rules are all it takes.
              Your human visitors will never notice.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={DOCS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto bg-brand-dark hover:bg-brand-mid text-white font-semibold px-8 py-3.5 rounded-xl transition-colors duration-200 text-base"
              >
                Read the docs →
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto flex items-center justify-center gap-2 text-gray-500 hover:text-brand-dark font-medium px-8 py-3.5 rounded-xl hover:bg-gray-50 transition-all duration-200 border border-transparent hover:border-gray-200"
              >
                <GitHubIcon />
                View on GitHub
              </a>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-gray-100 py-10">
        <div className="container-page flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-2 gap-y-1">
            <span aria-hidden="true">🌊</span>
            <span className="font-semibold text-gray-700">ScraperKast</span>
            <span aria-hidden="true">·</span>
            <span>MIT License · 2026 Chirag Ravishankar</span>
          </div>

          <div className="flex gap-5">
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-brand-dark transition-colors">GitHub</a>
            <a href={NPM_URL}    target="_blank" rel="noopener noreferrer" className="hover:text-brand-dark transition-colors">npm</a>
            <a href={DOCS_URL}   target="_blank" rel="noopener noreferrer" className="hover:text-brand-dark transition-colors">Docs</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
