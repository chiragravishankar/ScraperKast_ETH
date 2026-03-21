# Pricing Rules

The `rules` array is the core of your ScraperKast configuration. It tells
the middleware what to charge AI bots for access to different parts of your
site.

→ [Configuration](./configuration.md) · [Bot Detection](./bot-detection.md) · [API Reference](./api-reference.md)

---

## The `PricingRule` interface

```ts
interface PricingRule {
  id:           string;
  path?:        string;
  bot?:         string;
  pricePerPage: number;
  licenseType:  'summarization' | 'full_display';
}
```

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique identifier for this rule. Appears in logs and `matchedRuleId`. |
| `path` | No | URL path pattern. Omit to match any path. |
| `bot` | No | Exact bot name from `detectBot()`. Omit to match any bot. |
| `pricePerPage` | Yes | Price in micro-dollars (µ$). `100` = $0.001. `0` = free. |
| `licenseType` | Yes | What the bot may do with the content. |

---

## How pricing works

When a bot request arrives with no valid token, the middleware calls
`PricingEngine.getPrice(path, botName)`, which:

1. Scans all rules in descending specificity order.
2. Returns the first rule where both `path` and `bot` match.
3. Returns `null` if no rule matches → bot gets **403 Forbidden**.

If a rule matches, the middleware returns **402 Payment Required** with the
`pricePerPage` from that rule and a `paymentUrl` the bot operator can use
to purchase a token.

---

## Rule specificity

When multiple rules could match, the **most specific rule always wins**.
Specificity is determined by how many of `path` and `bot` are set:

| Has `path` | Has `bot` | Specificity | Example |
|:---:|:---:|:---:|---|
| ✓ | ✓ | **3** (highest) | `path: '/blog/*', bot: 'OpenAI GPTBot'` |
| ✓ | – | **2** | `path: '/blog/*'` |
| – | ✓ | **1** | `bot: 'OpenAI GPTBot'` |
| – | – | **0** (lowest) | global catch-all |

Within the same specificity level, the **first rule defined wins** (insertion
order). The pricing engine sorts internally — you don't need to write rules
in any particular order, though doing so improves readability.

### Specificity in action

```ts
rules: [
  // Rank 3 — most specific: GPTBot on /blog/* → $0.01
  { id: 'blog-gpt',  path: '/blog/*', bot: 'OpenAI GPTBot', pricePerPage: 1000, licenseType: 'full_display'  },

  // Rank 2 — any bot on /blog/* → $0.001
  { id: 'blog',      path: '/blog/*',                       pricePerPage: 100,  licenseType: 'summarization' },

  // Rank 1 — GPTBot on any path → $0.0005
  { id: 'gpt',                        bot: 'OpenAI GPTBot', pricePerPage: 50,   licenseType: 'summarization' },

  // Rank 0 — any bot, any path → $0.0001
  { id: 'global',                                            pricePerPage: 10,   licenseType: 'summarization' },
]
```

| Request | Winning rule | Price |
|---|---|---|
| GPTBot → `/blog/post-1` | `blog-gpt` (rank 3) | $0.01 |
| PerplexityBot → `/blog/post-1` | `blog` (rank 2) | $0.001 |
| GPTBot → `/docs/api` | `gpt` (rank 1) | $0.0005 |
| PerplexityBot → `/docs/api` | `global` (rank 0) | $0.0001 |

---

## Wildcard path syntax

| Pattern | Matches | Does not match |
|---|---|---|
| `/blog/*` | `/blog/my-post`, `/blog/intro` | `/blog/2024/post`, `/blog/` |
| `/docs/*/api` | `/docs/v2/api`, `/docs/v3/api` | `/docs/api`, `/docs/v2/ref/api` |
| `/api/**` | `/api`, `/api/v1`, `/api/v1/users/42` | `/admin/api` |
| `/about` | `/about` (exact) | `/about/team` |
| _(omitted)_ | any path | — |

### `*` vs `**`

- **`*`** matches exactly **one path segment** (no slashes).
- **`**`** as the final segment matches **zero or more trailing segments**
  (any depth). It must appear as the last segment.

```ts
// * — one segment
{ id: 'blog-posts', path: '/blog/*', ... }
// matches:     /blog/my-post
// no match:    /blog/2024/my-post

// ** — any depth
{ id: 'api-all', path: '/api/**', ... }
// matches:     /api
//              /api/v1
//              /api/v1/users
//              /api/v1/users/42/profile
```

### Path normalisation

Trailing slashes are stripped before matching (except the root `/`):

- `/blog/post-1/` is treated as `/blog/post-1`
- `/` stays as `/`

---

## `licenseType`

| Value | Meaning |
|---|---|
| `'summarization'` | The bot may summarise or quote the content, but not reproduce it verbatim in full. |
| `'full_display'` | The bot may reproduce the full content (e.g. for training datasets). |

`licenseType` is returned in the `PriceResult` object from `getPrice()` but
is **not** currently enforced by the middleware — it is a signal you can use
in your own post-processing or logging. Enforcement at the content layer is
on the roadmap.

---

## `pricePerPage` reference

`pricePerPage` is in **micro-dollars (µ$)**. The formula is:

```
pricePerPage ÷ 100,000 = price in USD
```

| `pricePerPage` | USD per page | Typical use |
|---:|---|---|
| `10` | $0.0001 | Low-value pages, free-tier alternative |
| `100` | $0.001 | Standard blog or article |
| `500` | $0.005 | Technical docs, tutorials |
| `1000` | $0.01 | Premium content, research |
| `5000` | $0.05 | High-value research, proprietary data |
| `100000` | $1.00 | Per-page licensing of exclusive content |
| `0` | Free | Explicitly allow free access |

---

## Common scenarios

### Uniform pricing — same price for all bots everywhere

```ts
rules: [
  { id: 'global', pricePerPage: 100, licenseType: 'summarization' },
]
```

Every AI bot on every path gets a 402 for $0.001 until it has a token.

---

### Per-path pricing — charge more for premium content

```ts
rules: [
  { id: 'research', path: '/research/**', pricePerPage: 5000, licenseType: 'full_display'  },
  { id: 'blog',     path: '/blog/*',      pricePerPage: 100,  licenseType: 'summarization' },
  { id: 'docs',     path: '/docs/**',     pricePerPage: 500,  licenseType: 'summarization' },
  { id: 'default',                         pricePerPage: 50,   licenseType: 'summarization' },
]
```

---

### Per-bot pricing — charge training bots more than inference bots

```ts
rules: [
  // Training bots (building datasets) pay $0.01
  { id: 'blog-training', path: '/blog/*', bot: 'OpenAI GPTBot',      pricePerPage: 1000, licenseType: 'full_display'  },
  { id: 'blog-ccbot',    path: '/blog/*', bot: 'Common Crawl CCBot', pricePerPage: 1000, licenseType: 'full_display'  },

  // Inference bots (answering user queries live) pay $0.005
  { id: 'blog-perp',     path: '/blog/*', bot: 'Perplexity PerplexityBot', pricePerPage: 500, licenseType: 'summarization' },
  { id: 'blog-chatgpt',  path: '/blog/*', bot: 'OpenAI ChatGPT-User',      pricePerPage: 500, licenseType: 'summarization' },

  // Catch-all for other bots on /blog/*
  { id: 'blog-default',  path: '/blog/*', pricePerPage: 100, licenseType: 'summarization' },
]
```

---

### Free access for certain paths

Set `pricePerPage: 0` to explicitly allow bots through a path at no cost.
Bots still need a valid token — the token is just free to acquire.

```ts
rules: [
  { id: 'public',  path: '/public/**', pricePerPage: 0,    licenseType: 'summarization' },
  { id: 'blog',    path: '/blog/*',    pricePerPage: 100,  licenseType: 'summarization' },
  { id: 'premium', path: '/premium/*', pricePerPage: 1000, licenseType: 'full_display'  },
]
```

---

### Block specific bots entirely (no payment option)

Omit a rule for a bot+path combination to return **403 Forbidden** with no
`paymentUrl`. The bot is not offered a way to pay — it's simply blocked.

```ts
rules: [
  // Only Perplexity and ChatGPT can pay for blog access
  { id: 'blog-perp',    path: '/blog/*', bot: 'Perplexity PerplexityBot', pricePerPage: 500,  licenseType: 'summarization' },
  { id: 'blog-chatgpt', path: '/blog/*', bot: 'OpenAI ChatGPT-User',      pricePerPage: 500,  licenseType: 'summarization' },
  // GPTBot (training) has no rule → hits /blog/* → 403, no payment offered
]
```

---

### Protecting the homepage from bots only

Leave the homepage out of all pricing rules. Any bot hitting `/` with no
matching rule will get **403 Forbidden**. Human visitors are never affected.

```ts
rules: [
  // No rule covers '/' — bots get 403 there
  { id: 'blog', path: '/blog/*', pricePerPage: 100, licenseType: 'summarization' },
]
```

---

## Debugging rule matching

The `PriceResult` returned by `getPrice()` includes `matchedRuleId`, which
tells you exactly which rule was applied:

```ts
import { PricingEngine } from '@scraperkast/core';

const engine = new PricingEngine(rules);
const result = engine.getPrice('/blog/my-post', 'OpenAI GPTBot');
// result = { pricePerPage: 1000, licenseType: 'full_display', matchedRuleId: 'blog-gpt' }
```

You can also log `matchedRuleId` inside `onAuthorized` or `onPaymentRequired`
callbacks to trace which rule fired in production.
