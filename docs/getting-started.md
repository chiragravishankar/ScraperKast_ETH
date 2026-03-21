# Getting Started

This guide takes you from zero to a running ScraperKast integration in about
five minutes.

→ [Configuration](./configuration.md) · [Pricing Rules](./pricing-rules.md) · [Bot Detection](./bot-detection.md)

---

## Prerequisites

- **Node.js 18+** — required for the built-in `fetch` API and ESM support
- **Express 4 or 5** — ScraperKast is a peer dependency of Express
- An npm account if you want to publish your own fork (optional)

---

## Installation

```bash
npm install @scraperkast/middleware-express
```

This pulls in `@scraperkast/core` automatically as a dependency.

---

## Quick start

```ts
import express from 'express';
import { scraperKast } from '@scraperkast/middleware-express';

const app = express();

app.use(scraperKast({
  jwtSecret: process.env.JWT_SECRET!,
  rules: [
    { id: 'global', pricePerPage: 100, licenseType: 'summarization' },
  ],
}));

app.get('/', (_req, res) => res.send('Hello, humans!'));

app.listen(3000, () => console.log('Listening on http://localhost:3000'));
```

That's the complete integration. Human visitors get a normal 200 response.
AI bots without a valid token receive a 402 with payment instructions.

---

## Your first pricing rule

The `rules` array is where you define your monetization policy. Each rule
is a `PricingRule` object:

```ts
{
  id: 'blog',            // unique identifier — use it in logs and alerts
  path: '/blog/*',       // which paths this rule covers (optional)
  bot: 'OpenAI GPTBot',  // which bot this rule targets (optional)
  pricePerPage: 100,     // price in micro-dollars: 100 = $0.001 per page
  licenseType: 'summarization', // what the bot can do with the content
}
```

A minimal rule with no `path` or `bot` is a global catch-all — it applies
to every bot on every path:

```ts
rules: [
  { id: 'catch-all', pricePerPage: 100, licenseType: 'summarization' },
]
```

Add path-specific rules to charge differently for premium content:

```ts
rules: [
  { id: 'premium', path: '/research/**', pricePerPage: 5000, licenseType: 'full_display' },
  { id: 'blog',    path: '/blog/*',      pricePerPage: 100,  licenseType: 'summarization' },
  { id: 'default',                        pricePerPage: 50,   licenseType: 'summarization' },
]
```

See [Pricing Rules](./pricing-rules.md) for the full specificity model and
wildcard syntax.

---

## Environment variables

Never hard-code `jwtSecret`. Use an environment variable:

```bash
# .env
JWT_SECRET=change-this-to-a-long-random-string-in-production
PORT=3000
```

Load it with `dotenv`:

```ts
import 'dotenv/config';
import express from 'express';
import { scraperKast } from '@scraperkast/middleware-express';

const app = express();

if (!process.env.JWT_SECRET) {
  console.error('ERROR: JWT_SECRET environment variable is required');
  process.exit(1);
}

app.use(scraperKast({
  jwtSecret: process.env.JWT_SECRET,
  rules: [ /* ... */ ],
}));
```

---

## Testing locally

### Simulate a human visitor

```bash
curl -i \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/124.0" \
  http://localhost:3000/blog/my-post
```

Expected: **200 OK** — the middleware doesn't touch human requests.

### Simulate an AI bot with no token

```bash
curl -i \
  -H "User-Agent: GPTBot/1.0 (+https://openai.com/gptbot)" \
  http://localhost:3000/blog/my-post
```

Expected: **402 Payment Required**

```json
{
  "error": "Payment Required",
  "bot": "OpenAI GPTBot",
  "pricing": { "pricePerPage": 100, "currency": "USD" },
  "paymentUrl": "https://api.scraperkast.com/pay?bot=OpenAI+GPTBot&path=%2Fblog%2Fmy-post",
  "documentation": "https://docs.scraperkast.com"
}
```

### Simulate an AI bot with a valid token

Generate a token using `@scraperkast/core`:

```ts
// scripts/generate-token.ts
import { AuthService } from '@scraperkast/core';

const auth = new AuthService(process.env.JWT_SECRET!);
const token = auth.generateToken('openai-test', 100, []);
console.log(token);
```

```bash
tsx scripts/generate-token.ts
# eyJhbGci...

TOKEN="eyJhbGci..."
curl -i \
  -H "User-Agent: GPTBot/1.0 (+https://openai.com/gptbot)" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/blog/my-post
```

Expected: **200 OK** — the bot gets through with your route's normal response.

### Use the built-in test client

The demo app includes a CLI bot simulator:

```bash
cd examples/express-demo

# Bot with no token
tsx test-bot.ts --bot "GPTBot/1.0" --path /blog/my-post

# Bot with a token
tsx test-bot.ts --bot "GPTBot/1.0" --path /blog/my-post --token eyJhbGci...

# See all options
tsx test-bot.ts --help
```

---

## Next steps

- **[Configuration](./configuration.md)** — learn every `ScraperKastConfig` option
- **[Pricing Rules](./pricing-rules.md)** — wildcard paths, per-bot pricing, free access
- **[Authentication](./authentication.md)** — understand the full token lifecycle
- **[Bot Detection](./bot-detection.md)** — see all 18 detected bots and their UA strings
