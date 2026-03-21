# ScraperKast Documentation

> AI bot paywall for Express.js — open-source alternative to TollBit.

ScraperKast is a middleware that intercepts AI bot traffic on your website,
gates it behind JWT authentication and your pricing rules, and lets human
visitors through without any overhead.

---

## Navigation

| Guide | What you'll learn |
|---|---|
| [Getting Started](./getting-started.md) | Install, quick start, first pricing rule, test locally |
| [Configuration](./configuration.md) | Every `ScraperKastConfig` option explained with examples |
| [Pricing Rules](./pricing-rules.md) | Rule specificity, wildcard paths, common pricing patterns |
| [Authentication](./authentication.md) | How JWT tokens work, token lifecycle, security |
| [Analytics](./analytics.md) | What gets tracked, how to read stats, privacy |
| [Bot Detection](./bot-detection.md) | All 18 detected bots, UA strings, bot types |
| [API Reference](./api-reference.md) | Full TypeScript interfaces and function signatures |
| [Self-Hosting](./self-hosting.md) | Environment variables, Docker, production checklist |

---

## How it works in one diagram

```
Incoming request
       │
       ▼
  Known AI bot?  ──── No ────→  next()  →  your route  [200]
       │
      Yes
       │
       ▼
  Valid Bearer JWT
  with credits > 0? ── Yes ──→  onAuthorized()  →  next()  →  [200]
       │
      No
       │
       ▼
  Pricing rule
  matches?  ────── No ────────→  403 Forbidden
       │
      Yes
       │
       ▼
  402 Payment Required  (JSON with paymentUrl)
```

---

## Packages

| Package | npm | Description |
|---|---|---|
| `@scraperkast/core` | [![npm](https://img.shields.io/npm/v/@scraperkast/core)](https://www.npmjs.com/package/@scraperkast/core) | Bot detection, pricing engine, auth, analytics |
| `@scraperkast/middleware-express` | [![npm](https://img.shields.io/npm/v/@scraperkast/middleware-express)](https://www.npmjs.com/package/@scraperkast/middleware-express) | Express.js middleware factory |

---

## Quick links

- [GitHub repository](https://github.com/chiragravishankar/scraperkast)
- [Contributing guide](../CONTRIBUTING.md)
- [npm — core](https://www.npmjs.com/package/@scraperkast/core)
- [npm — middleware](https://www.npmjs.com/package/@scraperkast/middleware-express)
- [Report a bug](https://github.com/chiragravishankar/scraperkast/issues)
- [Request a feature](https://github.com/chiragravishankar/scraperkast/discussions)
