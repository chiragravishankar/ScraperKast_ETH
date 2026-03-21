# Configuration

Full reference for the `ScraperKastConfig` object passed to `scraperKast()`.

→ [Getting Started](./getting-started.md) · [Pricing Rules](./pricing-rules.md) · [API Reference](./api-reference.md)

---

## TypeScript interface

```ts
interface ScraperKastConfig {
  rules:              PricingRule[];
  jwtSecret:          string;
  enableAnalytics?:   boolean;
  onAuthorized?:      (req: Request, botName: string) => void;
  onPaymentRequired?: (req: Request) => void;
}
```

---

## `rules` — `PricingRule[]` _(required)_

The access-control and pricing policy for your site. Rules are evaluated in
descending specificity order — the most specific matching rule always wins.

```ts
rules: [
  {
    id: 'blog',
    path: '/blog/*',
    pricePerPage: 100,
    licenseType: 'summarization',
  },
]
```

An empty array means every bot gets a 403 Forbidden on every path.

See [Pricing Rules](./pricing-rules.md) for the complete rule system,
specificity model, and wildcard syntax.

---

## `jwtSecret` — `string` _(required)_

The HMAC-SHA256 secret used to verify JWT tokens that bots send in the
`Authorization: Bearer <token>` header.

```ts
jwtSecret: process.env.JWT_SECRET!
```

**Requirements:**
- Must be the same secret that the ScraperKast payment server used to sign
  the token. Mismatch = token rejected.
- Must be a non-empty string. Passing an empty string throws at middleware
  initialisation time.
- Use at least 32 random characters in production.

**Generate a strong secret:**

```bash
# macOS / Linux
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Never hard-code the secret in source code.** Load it from an environment
variable or a secrets manager (AWS Secrets Manager, Vault, Doppler, etc.).

---

## `enableAnalytics` — `boolean` _(default: `false`)_

When `true`, the middleware records every bot access event and 402 issuance
in an in-memory `AnalyticsCollector`. Useful for dashboards and debugging.

```ts
app.use(scraperKast({
  jwtSecret: process.env.JWT_SECRET!,
  rules: [...],
  enableAnalytics: true,
}));
```

**Current limitations:**
- In-memory only — data is lost on process restart.
- The collector lives inside the middleware closure; see [Analytics](./analytics.md)
  for how to expose it via a separate admin route.
- A database persistence plugin is planned for a future release.

---

## `onAuthorized` — `(req, botName) => void` _(optional)_

Called immediately before a credentialed bot is allowed through to your
route handler. Use this for logging, credit decrement in your own store,
or firing a webhook.

```ts
onAuthorized(req, botName) {
  console.log(`✅ ${botName} → ${req.path}`);
}
```

**Arguments:**

| Name | Type | Description |
|---|---|---|
| `req` | `express.Request` | The original Express request object |
| `botName` | `string` | The matched bot name, e.g. `"OpenAI GPTBot"` |

**Guarantees:**
- Called only when the bot has a valid, unexpired JWT with `credits > 0`.
- Errors thrown inside this callback are caught silently — they never crash
  the middleware or propagate to your route handler.
- Called synchronously before `next()`.

**Example — decrement credits in a database:**

```ts
onAuthorized(req, botName) {
  // Fire-and-forget — don't await in middleware callbacks
  db.decrementCredits(botName).catch(console.error);
}
```

---

## `onPaymentRequired` — `(req) => void` _(optional)_

Called immediately before a 402 Payment Required response is sent. Use this
for logging or alerting.

```ts
onPaymentRequired(req) {
  const ua = req.headers['user-agent'] ?? 'unknown';
  console.log(`💰 PAYMENT REQUIRED  ${ua}  →  ${req.path}`);
}
```

**Arguments:**

| Name | Type | Description |
|---|---|---|
| `req` | `express.Request` | The original Express request object |

**Guarantees:**
- Called only when a pricing rule matched (i.e. not for 403 responses).
- Errors thrown inside this callback are caught silently.
- By the time `onPaymentRequired` returns, the 402 response has already been
  queued; you cannot cancel or modify it from this callback.

---

## Complete example with all options

```ts
import express from 'express';
import { scraperKast, AnalyticsCollector } from '@scraperkast/middleware-express';

const app = express();
const analytics = new AnalyticsCollector();

app.use(scraperKast({
  jwtSecret: process.env.JWT_SECRET!,

  rules: [
    // Most specific: OpenAI training data costs more on the research section
    { id: 'research-gpt',  path: '/research/**', bot: 'OpenAI GPTBot',  pricePerPage: 5000, licenseType: 'full_display'  },
    // Path-only: any bot on /research/** pays $0.005
    { id: 'research',      path: '/research/**',                         pricePerPage: 500,  licenseType: 'summarization' },
    // Bot-only: GPTBot on all other pages pays $0.001
    { id: 'gpt-default',                          bot: 'OpenAI GPTBot',  pricePerPage: 100,  licenseType: 'summarization' },
    // Global fallback: any other bot anywhere pays $0.0005
    { id: 'global',                                                       pricePerPage: 50,   licenseType: 'summarization' },
  ],

  enableAnalytics: true,

  onAuthorized(req, botName) {
    console.log(`✅  ${botName.padEnd(28)} ${req.method} ${req.path}`);
    // Optionally decrement credits in your database
    // creditsDb.decrement(botName).catch(console.error);
  },

  onPaymentRequired(req) {
    console.log(`💰  PAYMENT REQUIRED  ${req.path}`);
    // Optionally fire a webhook or notification
  },
}));

// Internal admin endpoint — protect this in production!
app.get('/internal/stats', (_req, res) => {
  res.json(analytics.getStats());
});

app.listen(3000);
```

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | **Yes** | HMAC secret for token verification |
| `PORT` | No | Port the server listens on (default: `3000`) |

**`.env.example`** (copy to `.env` locally):

```bash
JWT_SECRET=change-this-to-a-long-random-string-in-production
PORT=3000
```

---

## Best practices

**1. Validate the secret at startup**

```ts
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('JWT_SECRET must be at least 32 characters');
  process.exit(1);
}
```

**2. Define rules from most to least specific**

Although the engine re-sorts by specificity internally, writing rules in
specificity order makes your config easier to read at a glance.

**3. Always include a global fallback if you want bots blocked everywhere**

If a bot hits a path with no matching rule, it gets a 403. This is intentional.
If you'd rather every bot get a payment prompt, add a global rule:

```ts
{ id: 'global', pricePerPage: 100, licenseType: 'summarization' }
```

**4. Use `onAuthorized` to debit credits in your own store**

The JWT carries a `credits` field, but the middleware doesn't decrement it
automatically (that would require a database round-trip on every request).
Use `onAuthorized` to debit the count in your own store and issue a new
token when credits hit zero.

**5. Keep `enableAnalytics: false` in production until you add persistence**

The in-memory analytics collector grows unboundedly. In a long-running
production process this will cause a memory leak. A persistence plugin is
planned; until then, use `onAuthorized` and `onPaymentRequired` callbacks
to write events to your own store.
