# Bot Detection

ScraperKast identifies AI bots by matching the `User-Agent` request header
against a curated list of regex patterns. Detection is synchronous, runs in
microseconds, and has no external dependencies.

→ [Getting Started](./getting-started.md) · [API Reference](./api-reference.md) · [Pricing Rules](./pricing-rules.md)

---

## How it works

```ts
import { detectBot } from '@scraperkast/core';

const result = detectBot(req.headers['user-agent'] ?? '');
```

The function scans the User-Agent string against every bot definition in
priority order. The first match wins. If no pattern matches, the request is
treated as human traffic and the middleware calls `next()` immediately.

Detection is **case-insensitive** and works on partial User-Agent strings
(bots often embed their token inside a longer UA string such as
`Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)`).

---

## `BotDetectionResult`

```ts
interface BotDetectionResult {
  isBot:      boolean;          // true if a known bot pattern matched
  botName:    string | null;    // human-readable name, e.g. "OpenAI GPTBot"
  confidence: number;           // 0–1, how certain the match is
  type:       BotType | null;   // category of the bot, or null for humans
}

type BotType =
  | 'ai_training'   // crawls to build training datasets (GPTBot, CCBot)
  | 'ai_inference'  // fetches content to answer live user queries (ChatGPT-User, PerplexityBot)
  | 'search'        // traditional search engine indexers (Googlebot, bingbot)
  | 'crawler'       // SEO / analytics crawlers (AhrefsBot, SemrushBot)
  | 'social'        // social link-preview fetchers (facebookexternalhit)
  | 'unknown';      // detected as bot but type unclassified
```

---

## All detected bots

18 bots across 5 companies and 4 categories.

### OpenAI

| `botName` | User-Agent token | `type` | `confidence` |
|---|---|---|---|
| `OpenAI GPTBot` | `GPTBot` | `ai_training` | 1.0 |
| `OpenAI ChatGPT-User` | `ChatGPT-User` | `ai_inference` | 1.0 |

**Example User-Agents:**

```
GPTBot/1.0 (+https://openai.com/gptbot)
Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot
```

---

### Anthropic

| `botName` | User-Agent token | `type` | `confidence` |
|---|---|---|---|
| `Anthropic Claude-Web` | `Claude-Web` | `ai_inference` | 1.0 |
| `Anthropic anthropic-ai` | `anthropic-ai` | `ai_training` | 1.0 |
| `Anthropic claude-bot` | `claude-bot` | `ai_inference` | 1.0 |

**Example User-Agents:**

```
Claude-Web/1.0 (+https://www.anthropic.com)
anthropic-ai/1.0
claude-bot/1.0
```

---

### Google

| `botName` | User-Agent token | `type` | `confidence` |
|---|---|---|---|
| `Google Google-Extended` | `Google-Extended` | `ai_training` | 1.0 |
| `Google Googlebot` | `Googlebot` | `search` | 1.0 |

> **Note:** `Google-Extended` is checked before `Googlebot` because
> `Google-Extended` is the more specific token. Both share the
> `Googlebot` prefix in some UA strings.

**Example User-Agents:**

```
Mozilla/5.0 (compatible; Google-Extended)
Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)
```

---

### Microsoft

| `botName` | User-Agent token | `type` | `confidence` |
|---|---|---|---|
| `Microsoft bingbot` | `bingbot` | `search` | 1.0 |

**Example User-Agent:**

```
Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)
```

---

### Perplexity

| `botName` | User-Agent token | `type` | `confidence` |
|---|---|---|---|
| `Perplexity PerplexitySearchBot` | `PerplexitySearchBot` | `ai_inference` | 1.0 |
| `Perplexity PerplexityBot` | `PerplexityBot` | `ai_inference` | 1.0 |

> **Note:** `PerplexitySearchBot` is checked before `PerplexityBot` to
> prevent the shorter token from consuming the more specific UA string.

**Example User-Agents:**

```
PerplexityBot/1.0
PerplexitySearchBot/1.0
```

---

### You.com

| `botName` | User-Agent token | `type` | `confidence` |
|---|---|---|---|
| `You.com YouBot` | `YouBot` | `ai_inference` | 1.0 |

---

### Cohere

| `botName` | User-Agent token | `type` | `confidence` |
|---|---|---|---|
| `Cohere cohere-ai` | `cohere-ai` | `ai_training` | 1.0 |

---

### Common Crawl

| `botName` | User-Agent token | `type` | `confidence` |
|---|---|---|---|
| `Common Crawl CCBot` | `CCBot` | `ai_training` | 1.0 |

**Example User-Agent:**

```
CCBot/2.0 (https://commoncrawl.org/faq/)
```

---

### SEO crawlers

| `botName` | User-Agent token | `type` | `confidence` |
|---|---|---|---|
| `Semrush SemrushBot` | `SemrushBot` | `crawler` | 1.0 |
| `Ahrefs AhrefsBot` | `AhrefsBot` | `crawler` | 1.0 |
| `Moz DotBot` | `DotBot` | `crawler` | 1.0 |

---

### Meta

| `botName` | User-Agent token | `type` | `confidence` |
|---|---|---|---|
| `Meta Meta-ExternalAgent` | `Meta-ExternalAgent` | `ai_inference` | 1.0 |
| `Meta facebookexternalhit` | `facebookexternalhit` | `social` | **0.9** |

> `facebookexternalhit` has a confidence of 0.9 (not 1.0) because the token
> is shared between Facebook's link previewer and some third-party scrapers
> that spoof the UA.

---

## Summary table

| `botName` | Token | `type` |
|---|---|---|
| `OpenAI GPTBot` | `GPTBot` | `ai_training` |
| `OpenAI ChatGPT-User` | `ChatGPT-User` | `ai_inference` |
| `Anthropic Claude-Web` | `Claude-Web` | `ai_inference` |
| `Anthropic anthropic-ai` | `anthropic-ai` | `ai_training` |
| `Anthropic claude-bot` | `claude-bot` | `ai_inference` |
| `Google Google-Extended` | `Google-Extended` | `ai_training` |
| `Google Googlebot` | `Googlebot` | `search` |
| `Microsoft bingbot` | `bingbot` | `search` |
| `Perplexity PerplexitySearchBot` | `PerplexitySearchBot` | `ai_inference` |
| `Perplexity PerplexityBot` | `PerplexityBot` | `ai_inference` |
| `You.com YouBot` | `YouBot` | `ai_inference` |
| `Cohere cohere-ai` | `cohere-ai` | `ai_training` |
| `Common Crawl CCBot` | `CCBot` | `ai_training` |
| `Semrush SemrushBot` | `SemrushBot` | `crawler` |
| `Ahrefs AhrefsBot` | `AhrefsBot` | `crawler` |
| `Moz DotBot` | `DotBot` | `crawler` |
| `Meta Meta-ExternalAgent` | `Meta-ExternalAgent` | `ai_inference` |
| `Meta facebookexternalhit` | `facebookexternalhit` | `social` |

---

## Using `type` in pricing rules

The `type` field lets you apply coarse-grained policy decisions before
writing specific per-bot rules. Filter by type in your `onAuthorized` or
`onPaymentRequired` callbacks, or use it to decide which bots to offer
pricing to:

```ts
import { detectBot } from '@scraperkast/core';

// In a custom middleware layer before scraperKast:
app.use((req, _res, next) => {
  const result = detectBot(req.headers['user-agent'] ?? '');

  if (result.isBot && result.type === 'crawler') {
    // Block all SEO crawlers outright — no payment option
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
});
```

---

## Confidence score

Most bots have `confidence: 1.0` because their User-Agent tokens are
unique and well-documented. `facebookexternalhit` is the only bot currently
assigned a lower confidence (`0.9`).

You can use confidence in your own logic:

```ts
const result = detectBot(userAgent);

if (result.isBot && result.confidence < 1.0) {
  // Lower confidence — log for review but still apply pricing
  console.warn(`Low-confidence bot match: ${result.botName} (${result.confidence})`);
}
```

---

## Adding custom bot patterns

ScraperKast is open source — the bot definitions live in
`packages/core/src/botDetection.ts`. To add a new bot:

1. Add a `BotDefinition` object to the `BOT_DEFINITIONS` array:

```ts
{
  name: 'Acme AcmeBot',
  patterns: [/AcmeBot/i],
  confidence: 1.0,
  type: 'ai_training',
},
```

2. Add a test in `packages/core/src/botDetection.test.ts`:

```ts
it('detects AcmeBot', () => {
  const result = detectBot('AcmeBot/1.0 (+https://acme.com/bot)');
  expect(result.isBot).toBe(true);
  expect(result.botName).toBe('Acme AcmeBot');
  expect(result.type).toBe('ai_training');
});
```

3. Open a pull request — new bot additions are the easiest first contribution.
   See [CONTRIBUTING.md](../CONTRIBUTING.md) for the PR process.

**Pattern priority:** definitions are checked in array order. Place
more-specific patterns (longer tokens, stricter anchors) before
less-specific ones. The `Google-Extended` / `Googlebot` ordering is an
example of this — `Google-Extended` must come first to prevent `Googlebot`
from consuming User-Agents that contain `Google-Extended`.
