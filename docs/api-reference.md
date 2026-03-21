# API Reference

Complete TypeScript API for `@scraperkast/core` and
`@scraperkast/middleware-express`.

→ [Configuration](./configuration.md) · [Bot Detection](./bot-detection.md) · [Pricing Rules](./pricing-rules.md)

---

## `@scraperkast/core`

### Types

#### `BotType`

```ts
type BotType =
  | 'ai_training'   // GPTBot, CCBot, anthropic-ai, Google-Extended, cohere-ai
  | 'ai_inference'  // ChatGPT-User, Claude-Web, PerplexityBot, YouBot, Meta-ExternalAgent
  | 'search'        // Googlebot, bingbot
  | 'crawler'       // SemrushBot, AhrefsBot, DotBot
  | 'social'        // facebookexternalhit
  | 'unknown';
```

---

#### `BotDetectionResult`

Returned by `detectBot()`.

```ts
interface BotDetectionResult {
  isBot:      boolean;        // true when a known bot pattern matched
  botName:    string | null;  // e.g. "OpenAI GPTBot" — null when isBot is false
  confidence: number;         // 0–1, certainty of the match
  type:       BotType | null; // null when isBot is false
}
```

---

#### `LicenseType`

```ts
type LicenseType = 'summarization' | 'full_display';
```

---

#### `PricingRule`

Input to `PricingEngine` and the `rules` array in `ScraperKastConfig`.

```ts
interface PricingRule {
  id:           string;        // unique rule identifier
  path?:        string;        // URL path pattern — omit to match any path
  bot?:         string;        // exact botName — omit to match any bot
  pricePerPage: number;        // micro-dollars: 100 = $0.001, 0 = free
  licenseType:  LicenseType;
}
```

---

#### `PriceResult`

Returned by `PricingEngine.getPrice()`.

```ts
interface PriceResult {
  pricePerPage:    number;       // from the matched rule
  licenseType:     LicenseType;  // from the matched rule
  matchedRuleId:   string;       // id of the rule that won
}
```

---

#### `TokenPayload`

Returned by `AuthService.verifyToken()`.

```ts
interface TokenPayload {
  botId:          string;    // bot operator identifier
  credits:        number;    // remaining page credits
  allowedDomains: string[];  // [] = unrestricted
  exp:            number;    // Unix timestamp (seconds)
}
```

---

#### `BotAccessEvent`

Emitted by `AnalyticsCollector.trackAccess()`.

```ts
interface BotAccessEvent {
  timestamp: number;   // Unix milliseconds
  botName:   string;
  path:      string;
  allowed:   boolean;
  price?:    number;   // micro-dollars — present when price > 0
}
```

---

#### `PaymentRequiredEvent`

Emitted by `AnalyticsCollector.trackPaymentRequired()`.

```ts
interface PaymentRequiredEvent {
  timestamp: number;  // Unix milliseconds
  botName:   string;
  path:      string;
  price:     number;  // micro-dollars
}
```

---

#### `TopEntry`

Used in `AnalyticsStats.topBots` and `topPaths`.

```ts
interface TopEntry {
  name:     string;  // bot name or path
  requests: number;  // total request count
  revenue:  number;  // total revenue in micro-dollars
}
```

---

#### `AnalyticsStats`

Returned by `AnalyticsCollector.getStats()`.

```ts
interface AnalyticsStats {
  totalRequests: number;
  paidRequests:  number;
  revenue:       number;      // micro-dollars
  topBots:       TopEntry[];  // up to 10, sorted by requests desc
  topPaths:      TopEntry[];  // up to 10, sorted by requests desc
}
```

---

### Functions

#### `detectBot(userAgent)`

```ts
function detectBot(userAgent: string): BotDetectionResult
```

Detects whether a User-Agent string belongs to a known AI or crawler bot.

| Parameter | Type | Description |
|---|---|---|
| `userAgent` | `string` | Value of the `User-Agent` request header. Empty string or non-string → `{ isBot: false, ... }`. |

**Returns:** `BotDetectionResult`

**Examples:**

```ts
detectBot('GPTBot/1.0 (+https://openai.com/gptbot)')
// { isBot: true, botName: 'OpenAI GPTBot', confidence: 1, type: 'ai_training' }

detectBot('PerplexityBot/1.0')
// { isBot: true, botName: 'Perplexity PerplexityBot', confidence: 1, type: 'ai_inference' }

detectBot('Mozilla/5.0 (Macintosh) Chrome/124.0')
// { isBot: false, botName: null, confidence: 0, type: null }

detectBot('')
// { isBot: false, botName: null, confidence: 0, type: null }
```

---

### Classes

#### `PricingEngine`

```ts
class PricingEngine {
  constructor(rules: PricingRule[])
  getPrice(path: string, botName: string): PriceResult | null
}
```

##### `constructor(rules)`

Accepts an array of `PricingRule` objects. Rules are sorted internally by
descending specificity; insertion order breaks ties.

An empty array is valid — every `getPrice()` call will return `null`.

##### `getPrice(path, botName)`

Returns the `PriceResult` for the most-specific matching rule, or `null`
if no rule covers this `path` + `botName` combination.

| Parameter | Type | Description |
|---|---|---|
| `path` | `string` | Request path, e.g. `"/blog/my-post"`. |
| `botName` | `string` | `botName` from `detectBot()`, e.g. `"OpenAI GPTBot"`. |

**Example:**

```ts
const engine = new PricingEngine([
  { id: 'blog', path: '/blog/*', pricePerPage: 100, licenseType: 'summarization' },
  { id: 'global',                pricePerPage: 50,  licenseType: 'summarization' },
]);

engine.getPrice('/blog/post-1', 'OpenAI GPTBot')
// { pricePerPage: 100, licenseType: 'summarization', matchedRuleId: 'blog' }

engine.getPrice('/about', 'OpenAI GPTBot')
// { pricePerPage: 50, licenseType: 'summarization', matchedRuleId: 'global' }

engine.getPrice('/secret', 'OpenAI GPTBot') // no matching rule
// null
```

---

#### `AuthService`

```ts
class AuthService {
  constructor(secret: string)
  generateToken(botId: string, credits: number, domains: string[]): string
  verifyToken(token: string): TokenPayload | null
}
```

##### `constructor(secret)`

Throws if `secret` is empty or not a string.

##### `generateToken(botId, credits, domains)`

Issues a signed HS256 JWT valid for **1 hour**.

| Parameter | Type | Description |
|---|---|---|
| `botId` | `string` | Unique identifier for the bot operator. |
| `credits` | `number` | Number of page accesses granted. |
| `domains` | `string[]` | Allowed domains. `[]` = unrestricted. |

**Returns:** `string` — the JWT token.

##### `verifyToken(token)`

Verifies signature, algorithm, and expiry.

| Parameter | Type | Description |
|---|---|---|
| `token` | `string` | JWT string from the `Authorization: Bearer` header. |

**Returns:** `TokenPayload` if valid, `null` for expired, bad signature,
wrong algorithm, or malformed tokens.

---

#### `AnalyticsCollector`

```ts
class AnalyticsCollector {
  trackAccess(botName: string, path: string, allowed: boolean, price?: number): void
  trackPaymentRequired(botName: string, path: string, price: number): void
  getStats(): AnalyticsStats
  getAccessEvents(): readonly BotAccessEvent[]
  getPaymentEvents(): readonly PaymentRequiredEvent[]
}
```

##### `trackAccess(botName, path, allowed, price?)`

Records a bot access event. Pass `price` only when a payment was charged.

##### `trackPaymentRequired(botName, path, price)`

Records a 402 issuance event. Separate from `trackAccess` — a bot may
receive many 402s across different paths before purchasing a token.

##### `getStats()`

Returns a point-in-time snapshot. `topBots` and `topPaths` return up to
10 entries, sorted by request count descending.

##### `getAccessEvents()`

Returns a read-only copy of all access events. Useful for bulk export.

##### `getPaymentEvents()`

Returns a read-only copy of all payment-required events.

---

## `@scraperkast/middleware-express`

### `ScraperKastConfig`

```ts
interface ScraperKastConfig {
  rules:              PricingRule[];
  jwtSecret:          string;
  enableAnalytics?:   boolean;                                  // default: false
  onAuthorized?:      (req: Request, botName: string) => void;
  onPaymentRequired?: (req: Request) => void;
}
```

---

### Functions

#### `scraperKast(config)`

```ts
function scraperKast(config: ScraperKastConfig): RequestHandler
```

Returns an Express `RequestHandler` (middleware function). Mount with
`app.use()` before your routes.

**Errors thrown during initialisation** (e.g. empty `jwtSecret`) are thrown
synchronously at call time — before any request is processed.

**Errors during request processing** are forwarded to Express's error handler
via `next(err)`. Errors in `onAuthorized` and `onPaymentRequired` callbacks
are caught silently and never propagate.

**Example:**

```ts
import { scraperKast } from '@scraperkast/middleware-express';

app.use(scraperKast({
  jwtSecret: process.env.JWT_SECRET!,
  rules: [
    { id: 'global', pricePerPage: 100, licenseType: 'summarization' },
  ],
}));
```

---

### HTTP responses produced by the middleware

#### 200 OK

The middleware called `next()` — either the request is from a human, or the
bot had a valid JWT with `credits > 0`. The response is whatever your route
handler returns.

#### 402 Payment Required

```ts
interface PaymentRequiredBody {
  error:       'Payment Required';
  bot:         string;              // e.g. "OpenAI GPTBot"
  pricing: {
    pricePerPage: number;           // micro-dollars
    currency:     'USD';
  };
  paymentUrl:    string;            // URL to complete payment
  documentation: string;           // https://docs.scraperkast.com
}
```

#### 403 Forbidden

```ts
interface ForbiddenBody {
  error:   'Forbidden';
  message: string;   // e.g. 'Bot "OpenAI GPTBot" is not permitted to access /secret'
}
```

---

### Re-exports from `@scraperkast/middleware-express`

For convenience, the middleware package re-exports:

```ts
export { AnalyticsCollector } from '@scraperkast/core';
export type { PricingRule }   from '@scraperkast/core';
```

So you can import everything from one package:

```ts
import {
  scraperKast,
  AnalyticsCollector,
} from '@scraperkast/middleware-express';
import type { PricingRule } from '@scraperkast/middleware-express';
```
