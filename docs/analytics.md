# Analytics

ScraperKast includes a lightweight in-memory analytics collector that tracks
every bot access event and 402 issuance without any external dependencies.

→ [Configuration](./configuration.md) · [API Reference](./api-reference.md)

---

## What gets tracked

### Access events (`BotAccessEvent`)

Recorded on every bot request — whether the bot was allowed through, blocked
with 403, or sent a 402.

```ts
interface BotAccessEvent {
  timestamp: number;   // Unix ms — when the event occurred
  botName:   string;   // e.g. "OpenAI GPTBot"
  path:      string;   // e.g. "/blog/my-post"
  allowed:   boolean;  // true = bot got through, false = blocked or 402'd
  price?:    number;   // present when the bot paid (micro-dollars)
}
```

### Payment-required events (`PaymentRequiredEvent`)

Recorded each time a 402 is issued. Distinct from access events — a single
bot may trigger many 402s across different paths before purchasing a token.

```ts
interface PaymentRequiredEvent {
  timestamp: number;  // Unix ms
  botName:   string;  // e.g. "Perplexity PerplexityBot"
  path:      string;  // e.g. "/docs/api/auth"
  price:     number;  // micro-dollars of the matching rule
}
```

---

## Enabling analytics

Set `enableAnalytics: true` in your middleware config:

```ts
app.use(scraperKast({
  jwtSecret: process.env.JWT_SECRET!,
  rules: [...],
  enableAnalytics: true,
}));
```

---

## Accessing analytics data

The `AnalyticsCollector` lives inside the middleware closure, so the
simplest way to expose stats is via a separate admin route backed by your
own collector instance:

```ts
import { AnalyticsCollector } from '@scraperkast/middleware-express';

const analytics = new AnalyticsCollector();

app.use(scraperKast({
  jwtSecret: process.env.JWT_SECRET!,
  rules: [...],
  enableAnalytics: true,

  onAuthorized(req, botName) {
    analytics.trackAccess(botName, req.path, true);
  },

  onPaymentRequired(req) {
    // Payment-required events are tracked automatically inside the middleware;
    // track here only if you need a separate reference in your own collector.
  },
}));

// Protect this route in production — see security notes below
app.get('/internal/stats', (_req, res) => {
  res.json(analytics.getStats());
});
```

---

## `getStats()` return shape

```ts
interface AnalyticsStats {
  totalRequests: number;    // All bot requests (allowed + blocked + 402'd)
  paidRequests:  number;    // Requests where a price > 0 was charged
  revenue:       number;    // Sum of all prices (micro-dollars)
  topBots:       TopEntry[]; // Most active bots (by request count, desc)
  topPaths:      TopEntry[]; // Most accessed paths (by request count, desc)
}

interface TopEntry {
  name:     string;  // Bot name or path
  requests: number;  // Total request count
  revenue:  number;  // Total revenue in micro-dollars
}
```

**Example response:**

```json
{
  "totalRequests": 1042,
  "paidRequests": 839,
  "revenue": 83900,
  "topBots": [
    { "name": "OpenAI GPTBot",              "requests": 610, "revenue": 61000 },
    { "name": "Perplexity PerplexityBot",   "requests": 229, "revenue": 22900 },
    { "name": "Common Crawl CCBot",         "requests": 203, "revenue":     0 }
  ],
  "topPaths": [
    { "name": "/blog/intro-to-llms",        "requests": 287, "revenue": 28700 },
    { "name": "/blog/transformer-arch",     "requests": 201, "revenue": 20100 },
    { "name": "/docs/api/authentication",   "requests": 187, "revenue": 18700 }
  ]
}
```

**Reading revenue:** divide by 100,000 to get USD.
`83900 ÷ 100000 = $0.839` total revenue from 839 paid requests at $0.001 each.

---

## Raw event access

For export or custom aggregation, retrieve the underlying event arrays:

```ts
// All access events (a read-only copy)
const events = analytics.getAccessEvents();

// All payment-required events
const paymentEvents = analytics.getPaymentEvents();

// Example: export to your database
for (const event of events) {
  await db.insert('bot_access_events', {
    timestamp: new Date(event.timestamp),
    bot_name:  event.botName,
    path:      event.path,
    allowed:   event.allowed,
    price:     event.price ?? 0,
  });
}
```

---

## Dashboard (coming soon)

A hosted analytics dashboard is planned as an optional companion service.
It will connect to your ScraperKast instance via a webhook and provide:

- Real-time request volume graphs
- Revenue over time
- Top bots and paths
- Geographic breakdown
- 402 conversion funnel (how many bots that received a 402 eventually paid)

Until the dashboard is available, the `/internal/stats` JSON endpoint and
raw event arrays are the primary interfaces.

---

## Privacy considerations

### What ScraperKast does NOT collect

- IP addresses
- Request body content
- Query string parameters
- Response bodies
- Any personally identifiable information

ScraperKast analytics tracks only: bot name, path, timestamp, allowed/blocked
status, and price. No user data is ever collected or stored.

### Data locality

All analytics are **in-memory and local to your process**. No data is sent
to any external server unless you write it there yourself (e.g. in an
`onAuthorized` callback that writes to a remote database).

### Persistence and GDPR

Because analytics are in-memory only:

- Data is lost on process restart — there is nothing to delete.
- No personal data is collected — GDPR Article 4(1) "personal data" does not
  apply to bot names and paths.
- If you persist events to a database using the raw event API, your own
  data retention and deletion policies apply to that database.

### Protecting the stats endpoint

The `/internal/stats` endpoint exposes aggregated bot traffic information.
Protect it with at minimum a secret header:

```ts
app.get('/internal/stats', (req, res) => {
  if (req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(analytics.getStats());
});
```

In production, consider restricting the route to an internal network or
VPN rather than exposing it on the public internet.

---

## Memory usage

The `AnalyticsCollector` holds every event in two arrays (`accessEvents` and
`paymentEvents`) that grow indefinitely. For a high-traffic site:

- An `BotAccessEvent` object is approximately 120–180 bytes.
- 1 million events ≈ 120–180 MB of heap memory.

**Mitigation strategies until a persistence layer is added:**

1. Set `enableAnalytics: false` and write events directly to a database in
   `onAuthorized` / `onPaymentRequired` callbacks.
2. Periodically drain events to a database and recreate the collector.
3. Use the `topBots` / `topPaths` aggregates (which are O(1) per event)
   and discard raw events after a time window.
