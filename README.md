# 🌊 ScraperKast

**AI bot paywall for Express.js — open-source alternative to TollBit.**

[![License: MIT](https://img.shields.io/badge/License-MIT-02C39A.svg)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/@scraperkast/middleware-express?color=028090)](https://www.npmjs.com/package/@scraperkast/middleware-express)
[![npm version](https://img.shields.io/npm/v/@scraperkast/core?color=00A896&label=core)](https://www.npmjs.com/package/@scraperkast/core)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-028090.svg)](./CONTRIBUTING.md)

AI companies — OpenAI, Anthropic, Google, Perplexity — are training models
on web content right now. Publishers get nothing. ScraperKast changes that.

Add five lines of middleware to your Express app and every AI bot that hits
your site gets a machine-readable price tag. They pay, or they don't get in.
Human visitors never see a thing.

---

## Features

- **🤖 Detects 18 AI bots** — GPTBot, Claude, PerplexityBot, Google-Extended,
  CCBot, and more, by User-Agent pattern matching
- **💰 Flexible pricing rules** — charge per path, per bot, or globally;
  wildcards, per-bot overrides, and free tiers all supported
- **🔐 JWT authentication** — bots that have paid send a signed token;
  the middleware verifies it in microseconds with no database round-trip
- **📊 Built-in analytics** — track every access event, 402 issuance, and
  revenue in memory (database persistence coming soon)
- **🏠 Self-hostable for free** — runs entirely inside your existing Express
  app; no CDN, no reverse proxy, no external service required
- **🔓 MIT licensed** — audit every line, fork it, contribute to it

---

## Quick start

```bash
npm install @scraperkast/middleware-express
```

```ts
import express from 'express';
import { scraperKast } from '@scraperkast/middleware-express';

const app = express();

app.use(scraperKast({
  jwtSecret: process.env.JWT_SECRET!,
  rules: [
    { id: 'blog', path: '/blog/*', pricePerPage: 100, licenseType: 'summarization' },
  ],
}));

app.get('/blog/:slug', (req, res) => res.json({ slug: req.params.slug }));
app.listen(3000);
```

A human visitor to `/blog/my-post` gets a normal 200. GPTBot without a token
gets a 402:

```json
{
  "error": "Payment Required",
  "bot": "OpenAI GPTBot",
  "pricing": { "pricePerPage": 100, "currency": "USD" },
  "paymentUrl": "https://api.scraperkast.com/pay?bot=OpenAI+GPTBot&path=%2Fblog%2Fmy-post",
  "documentation": "https://docs.scraperkast.com"
}
```

---

## Packages

This is an npm workspace monorepo. Each package is independently published.

| Package | Version | Description |
|---|---|---|
| [`@scraperkast/core`](./packages/core) | [![npm](https://img.shields.io/npm/v/@scraperkast/core?label=%20)](https://www.npmjs.com/package/@scraperkast/core) | Bot detection, pricing engine, JWT auth, analytics |
| [`@scraperkast/middleware-express`](./packages/middleware-express) | [![npm](https://img.shields.io/npm/v/@scraperkast/middleware-express?label=%20)](https://www.npmjs.com/package/@scraperkast/middleware-express) | Express.js middleware factory |

---

## Repository structure

```
scraperkast/
│
├── packages/
│   ├── core/                   # @scraperkast/core
│   │   └── src/
│   │       ├── botDetection.ts     Bot UA pattern matching (18 bots)
│   │       ├── pricing.ts          Rule-based pricing engine
│   │       ├── auth.ts             JWT generation + verification
│   │       └── analytics.ts        In-memory event tracking
│   │
│   └── middleware-express/     # @scraperkast/middleware-express
│       ├── src/index.ts            Express RequestHandler factory
│       └── README.md               Package-level docs
│
├── examples/
│   └── express-demo/           Runnable demo Express app
│       ├── src/server.ts
│       ├── test-bot.ts             CLI bot simulator
│       └── DEMO.md                 5-minute demo video script
│
├── apps/
│   └── landing/                Next.js 14 landing page (scraperkast.com)
│
├── docs/                       Full documentation (Markdown)
│   ├── getting-started.md
│   ├── configuration.md
│   ├── pricing-rules.md
│   ├── authentication.md
│   ├── analytics.md
│   ├── bot-detection.md
│   ├── api-reference.md
│   └── self-hosting.md
│
├── tsconfig.base.json          Shared TypeScript config
├── package.json                Workspace root
├── LICENSE                     MIT
└── CONTRIBUTING.md             Contributor guide
```

---

## Documentation

| Guide | Description |
|---|---|
| [Getting Started](./docs/getting-started.md) | Install, quick start, testing locally |
| [Configuration](./docs/configuration.md) | Every `ScraperKastConfig` option |
| [Pricing Rules](./docs/pricing-rules.md) | Rule specificity, wildcards, patterns |
| [Authentication](./docs/authentication.md) | JWT token lifecycle and security |
| [Analytics](./docs/analytics.md) | Event tracking and stats |
| [Bot Detection](./docs/bot-detection.md) | All 18 bots with UA strings |
| [API Reference](./docs/api-reference.md) | Full TypeScript API |
| [Self-Hosting](./docs/self-hosting.md) | Docker, nginx, production checklist |

---

## Demo

A complete runnable demo lives in [`examples/express-demo/`](./examples/express-demo).

```bash
cd examples/express-demo
cp .env.example .env
npm install
npm run dev
# → http://localhost:3000
```

Simulate a bot with the included test client:

```bash
# Bot without token → 402
tsx test-bot.ts --bot "GPTBot/1.0" --path /blog/my-post

# Bot with token → 200
tsx test-bot.ts --bot "GPTBot/1.0" --path /blog/my-post --token eyJhbGc...

# All options
tsx test-bot.ts --help
```

---

## Development

```bash
# Clone
git clone https://github.com/chiragravishankar/scraperkast.git
cd scraperkast

# Install all workspace dependencies
npm install

# Build all packages
npm run build --workspaces --if-present

# Run all tests
npm test --workspaces --if-present
```

---

## Contributing

Contributions are welcome and appreciated. See [CONTRIBUTING.md](./CONTRIBUTING.md)
for the development setup, coding standards, PR process, and a list of
good first issues.

---

## License

[MIT](./LICENSE) © 2026 Chirag Ravishankar

---

<p align="center">
  <a href="https://scraperkast.com">scraperkast.com</a> ·
  <a href="https://www.npmjs.com/package/@scraperkast/middleware-express">npm</a> ·
  <a href="./docs/README.md">Docs</a> ·
  <a href="https://github.com/chiragravishankar/scraperkast/issues">Issues</a> ·
  <a href="https://github.com/chiragravishankar/scraperkast/discussions">Discussions</a>
</p>
