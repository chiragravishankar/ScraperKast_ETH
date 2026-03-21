# @scraperkast/middleware-express

Express middleware that intercepts AI bot traffic, gates it behind JWT authentication and your pricing rules, and lets human visitors through untouched.

---

## Installation

```bash
npm install @scraperkast/middleware-express
```

> **Peer dependency:** Express 4 or 5 must already be installed in your project.

---

## Quick Start

```ts
import express from 'express';
import { scraperKast } from '@scraperkast/middleware-express';

const app = express();

app.use(scraperKast({
  jwtSecret: process.env.SCRAPERKAST_SECRET!,
  rules: [
    {
      id: 'global',
      pricePerPage: 100,        // $0.001 per page
      licenseType: 'summarization',
    },
  ],
}));

app.get('/', (_req, res) => res.send('Hello, humans!'));
app.listen(3000);
```

That's it. Human visitors get a normal 200 response. AI bots without a valid token get a 402 with payment instructions.

---

## How It Works

Every incoming request passes through this decision tree:

```
Incoming request
       │
       ▼
  Known AI bot?  ──── No ────→  next()  →  your route handler  [200]
       │
      Yes
       │
       ▼
  Valid Bearer JWT
  with credits > 0? ── Yes ──→  onAuthorized()  →  next()  →  your route  [200]
       │
       No (missing / expired / zero credits)
       │
       ▼
  Pricing rule matches
  this bot + path? ──── No ───→  403 Forbidden
       │
      Yes
       │
       ▼
  onPaymentRequired()  →  402 Payment Required  (JSON body with payment URL)
```

**Key properties:**
- Human browsers are never inspected — zero overhead for your real users.
- Callbacks (`onAuthorized`, `onPaymentRequired`) are sandboxed; a throwing callback never crashes the middleware or your server.
- Unexpected internal errors are forwarded to Express's error handler via `next(err)`.

---

## Configuration

```ts
interface ScraperKastConfig {
  rules:               PricingRule[];
  jwtSecret:           string;
  enableAnalytics?:    boolean;
  onAuthorized?:       (req: Request, botName: string) => void;
  onPaymentRequired?:  (req: Request) => void;
}
```

### `rules` — `PricingRule[]` _(required)_

The access-control and pricing policy for your site. Rules are evaluated from most specific to least specific — `path + bot` beats `path only` beats `bot only` beats a global rule. See [Pricing Rules](#pricing-rules) below.

### `jwtSecret` — `string` _(required)_

The secret used to verify JWT tokens that bots send in the `Authorization` header. Must match the secret used by the ScraperKast payment server that issued the token. Load from an environment variable; never hard-code it.

```ts
jwtSecret: process.env.SCRAPERKAST_SECRET!
```

### `enableAnalytics` — `boolean` _(default: `false`)_

When `true`, every request is recorded in an in-memory `AnalyticsCollector`. Useful for dashboards and debugging. A database persistence layer is on the roadmap.

### `onAuthorized` — `(req, botName) => void` _(optional)_

Called immediately before a credentialed bot is allowed through. Use this to log access or decrement credits in your own store.

```ts
onAuthorized(req, botName) {
  console.log(`[ALLOW] ${botName} → ${req.path}`);
  myDb.decrementCredits(botName);
}
```

### `onPaymentRequired` — `(req) => void` _(optional)_

Called immediately before a 402 response is sent. Use this for logging or alerting.

```ts
onPaymentRequired(req) {
  console.log(`[BLOCK] ${req.headers['user-agent']} → ${req.path}`);
}
```

---

## Pricing Rules

```ts
interface PricingRule {
  id:           string;
  path?:        string;          // supports * and ** wildcards
  bot?:         string;          // exact botName from detectBot()
  pricePerPage: number;          // in micro-dollars: 100 = $0.001
  licenseType:  'summarization' | 'full_display';
}
```

### Price reference

| `pricePerPage` | Price per page |
|---------------:|----------------|
| `10`           | $0.0001        |
| `100`          | $0.001         |
| `500`          | $0.005         |
| `1000`         | $0.01          |
| `10000`        | $0.10          |

### Wildcard path syntax

| Pattern        | Matches                                        | Does not match          |
|----------------|------------------------------------------------|-------------------------|
| `/blog/*`      | `/blog/my-post`                                | `/blog/2024/my-post`    |
| `/docs/*/api`  | `/docs/v2/api`, `/docs/v3/api`                 | `/docs/api`             |
| `/api/**`      | `/api`, `/api/v1`, `/api/v1/users/42`          | `/admin/api`            |
| _(omitted)_    | any path                                       | —                       |

### Specificity (most specific rule wins)

| Rule type       | Example                                              |
|-----------------|------------------------------------------------------|
| path **+** bot  | `/blog/*` for `OpenAI GPTBot` only                  |
| path only       | `/blog/*` for any bot                               |
| bot only        | `OpenAI GPTBot` on any path                         |
| global          | any bot, any path                                   |

When two rules have equal specificity, the first one defined wins.

---

## Examples

### Basic: uniform pricing across the whole site

```ts
app.use(scraperKast({
  jwtSecret: process.env.SCRAPERKAST_SECRET!,
  rules: [
    {
      id: 'global',
      pricePerPage: 100,          // $0.001 per page for everyone
      licenseType: 'summarization',
    },
  ],
}));
```

---

### Blog protection with different prices per bot

Charge GPTBot (training) more than Perplexity (serving live answers to users).

```ts
app.use(scraperKast({
  jwtSecret: process.env.SCRAPERKAST_SECRET!,
  rules: [
    {
      id: 'blog-gpt',
      path: '/blog/*',
      bot: 'OpenAI GPTBot',
      pricePerPage: 1000,         // $0.01  — training use
      licenseType: 'full_display',
    },
    {
      id: 'blog-perplexity',
      path: '/blog/*',
      bot: 'Perplexity PerplexityBot',
      pricePerPage: 500,          // $0.005 — inference use
      licenseType: 'summarization',
    },
    {
      id: 'blog-default',
      path: '/blog/*',
      pricePerPage: 100,          // $0.001 — any other bot
      licenseType: 'summarization',
    },
  ],
}));
```

---

### Path-based pricing: charge more for premium content

```ts
app.use(scraperKast({
  jwtSecret: process.env.SCRAPERKAST_SECRET!,
  rules: [
    {
      id: 'research',
      path: '/research/**',
      pricePerPage: 5000,         // $0.05 — premium deep content
      licenseType: 'full_display',
    },
    {
      id: 'blog',
      path: '/blog/*',
      pricePerPage: 100,          // $0.001 — regular articles
      licenseType: 'summarization',
    },
    {
      id: 'global-fallback',
      pricePerPage: 50,           // $0.0005 — everything else
      licenseType: 'summarization',
    },
  ],
}));
```

---

### Free access for certain paths

Set `pricePerPage: 0` to explicitly allow bots through a path at no cost.

```ts
app.use(scraperKast({
  jwtSecret: process.env.SCRAPERKAST_SECRET!,
  rules: [
    {
      id: 'public-free',
      path: '/public/**',
      pricePerPage: 0,            // free — no token required
      licenseType: 'summarization',
    },
    {
      id: 'paid-content',
      path: '/premium/**',
      pricePerPage: 1000,         // $0.01
      licenseType: 'full_display',
    },
  ],
}));
```

> **Note:** A free rule (`pricePerPage: 0`) still requires a valid JWT from the bot. Without a token, the bot will receive a 402 pointing to a $0 payment, which completes the registration flow without charging the bot operator.

---

## HTTP Response Reference

### 402 Payment Required — bot has no valid token, rule exists

```http
HTTP/1.1 402 Payment Required
Content-Type: application/json

{
  "error": "Payment Required",
  "bot": "OpenAI GPTBot",
  "pricing": {
    "pricePerPage": 100,
    "currency": "USD"
  },
  "paymentUrl": "https://api.scraperkast.com/pay?bot=OpenAI+GPTBot&path=%2Fblog%2Fmy-post",
  "documentation": "https://docs.scraperkast.com"
}
```

### 403 Forbidden — bot has no token and no rule covers this path

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "error": "Forbidden",
  "message": "Bot \"OpenAI GPTBot\" is not permitted to access /private"
}
```

### 200 OK — bot has a valid JWT with credits

The request passes through to your route handler with no modification.

---

## Detected Bots

The middleware uses `@scraperkast/core`'s `detectBot()` to identify bots by `User-Agent`. The `bot` field in your pricing rules must match the `botName` string exactly.

| Bot name | User-Agent token | Type |
|---|---|---|
| `OpenAI GPTBot` | `GPTBot` | `ai_training` |
| `OpenAI ChatGPT-User` | `ChatGPT-User` | `ai_inference` |
| `Anthropic Claude-Web` | `Claude-Web` | `ai_inference` |
| `Anthropic anthropic-ai` | `anthropic-ai` | `ai_training` |
| `Anthropic claude-bot` | `claude-bot` | `ai_inference` |
| `Google Googlebot` | `Googlebot` | `search` |
| `Google Google-Extended` | `Google-Extended` | `ai_training` |
| `Microsoft bingbot` | `bingbot` | `search` |
| `Perplexity PerplexityBot` | `PerplexityBot` | `ai_inference` |
| `Perplexity PerplexitySearchBot` | `PerplexitySearchBot` | `ai_inference` |
| `You.com YouBot` | `YouBot` | `ai_inference` |
| `Cohere cohere-ai` | `cohere-ai` | `ai_training` |
| `Common Crawl CCBot` | `CCBot` | `ai_training` |
| `Semrush SemrushBot` | `SemrushBot` | `crawler` |
| `Ahrefs AhrefsBot` | `AhrefsBot` | `crawler` |
| `Moz DotBot` | `DotBot` | `crawler` |
| `Meta Meta-ExternalAgent` | `Meta-ExternalAgent` | `ai_inference` |
| `Meta facebookexternalhit` | `facebookexternalhit` | `social` |

---

## FAQ

### How do I test locally?

Use `curl` with a bot `User-Agent` to simulate a bot request:

```bash
# Simulate GPTBot with no token → expect 402
curl -i http://localhost:3000/blog/my-post \
  -H "User-Agent: GPTBot/1.0"

# Simulate GPTBot with a valid token → expect 200
TOKEN=$(node -e "
  const { AuthService } = require('@scraperkast/core');
  const svc = new AuthService(process.env.SCRAPERKAST_SECRET);
  console.log(svc.generateToken('openai', 100, []));
")
curl -i http://localhost:3000/blog/my-post \
  -H "User-Agent: GPTBot/1.0" \
  -H "Authorization: Bearer $TOKEN"

# Regular browser → always 200, middleware is transparent
curl -i http://localhost:3000/blog/my-post \
  -H "User-Agent: Mozilla/5.0 Chrome/124.0"
```

For automated tests, use [supertest](https://github.com/ladjs/supertest):

```ts
import request from 'supertest';
import { AuthService } from '@scraperkast/core';

const auth = new AuthService(process.env.SCRAPERKAST_SECRET!);
const token = auth.generateToken('openai', 50, []);

await request(app)
  .get('/blog/post')
  .set('User-Agent', 'GPTBot/1.0')
  .set('Authorization', `Bearer ${token}`)
  .expect(200);
```

---

### How do payments work?

When a bot receives a 402, the `paymentUrl` in the response body points to the ScraperKast payment server. The bot operator visits that URL, completes payment, and receives a signed JWT. On subsequent requests the bot sends that JWT as `Authorization: Bearer <token>`. The middleware verifies it and allows access until credits run out.

Your site never handles money directly — ScraperKast acts as the payment intermediary and signs the tokens with your shared `jwtSecret`.

---

### A bot is getting through that shouldn't be. What do I check?

1. **No rule matches** — if no rule covers that bot+path combination the middleware returns 403, not 402. Verify with `curl -i` and check the response body.
2. **Bot has a valid token** — the middleware allows any bot with a valid, credited JWT. Check the `onAuthorized` callback to log which bots are being admitted.
3. **Bot UA not recognised** — run `detectBot(userAgent)` from `@scraperkast/core` against the raw `User-Agent` string to confirm it's detected. If it's a new bot not in the list, open an issue.

---

### Can I block a specific bot entirely (no payment option)?

Yes. Omit a pricing rule for that bot+path combination — the middleware will return 403 with no `paymentUrl`.

```ts
rules: [
  // Only allow GPTBot to pay for blog access
  { id: 'blog-gpt', path: '/blog/*', bot: 'OpenAI GPTBot', pricePerPage: 100, licenseType: 'summarization' },
  // CCBot gets no rule → hits any path → 403, no payment offered
]
```

---

### How do I access analytics data?

Enable `enableAnalytics: true` and call `getStats()` on the collector. Because the collector lives inside the middleware closure, expose it through a separate admin route:

```ts
import { AnalyticsCollector } from '@scraperkast/middleware-express';

const analytics = new AnalyticsCollector();

app.use(scraperKast({
  jwtSecret: process.env.SCRAPERKAST_SECRET!,
  rules: [...],
  enableAnalytics: true,
  onAuthorized(_req, botName) {
    analytics.trackAccess(botName, _req.path, true);
  },
  onPaymentRequired(_req) {
    // tracked automatically inside the middleware
  },
}));

// Internal admin endpoint — protect this in production
app.get('/internal/stats', (_req, res) => {
  res.json(analytics.getStats());
});
```

`getStats()` returns:

```json
{
  "totalRequests": 1042,
  "paidRequests": 839,
  "revenue": 83900,
  "topBots": [
    { "name": "OpenAI GPTBot",          "requests": 610, "revenue": 61000 },
    { "name": "Perplexity PerplexityBot", "requests": 229, "revenue": 22900 }
  ],
  "topPaths": [
    { "name": "/blog/intro-to-llms",    "requests": 287, "revenue": 28700 },
    { "name": "/blog/transformer-arch", "requests": 201, "revenue": 20100 }
  ]
}
```
