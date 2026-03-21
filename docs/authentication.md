# Authentication

ScraperKast uses signed JSON Web Tokens (JWT) to authenticate AI bots that
have paid for access. This document explains the token structure, how bots
obtain tokens, the full lifecycle, and security best practices.

→ [Configuration](./configuration.md) · [API Reference](./api-reference.md) · [Self-Hosting](./self-hosting.md)

---

## How it works

```
Bot sends request
       │
       ▼
Middleware checks Authorization header
       │
  ┌────┴────┐
  │ Bearer  │
  │ token   │
  │ present?│
  └────┬────┘
       │ Yes
       ▼
AuthService.verifyToken(token)
       │
  ┌────┴─────────┐
  │ Valid + credits│
  │   > 0?       │
  └────┬─────────┘
       │ Yes             No
       ▼                 ▼
   next()         fall through to
  (200 OK)        pricing check
```

Tokens are **HS256 JWTs** signed with the `jwtSecret` you configure.
The middleware verifies the signature and checks that `credits > 0` before
allowing any bot through.

---

## Token payload

```ts
interface TokenPayload {
  botId:          string;    // "openai-gptbot", "anthropic", etc.
  credits:        number;    // remaining page credits (e.g. 500)
  allowedDomains: string[];  // domains this token is valid for ([] = all)
  exp:            number;    // Unix timestamp (seconds) — token expires here
}
```

### `botId`

A unique identifier for the AI company or bot operator. Used for analytics
and credit tracking. Assigned by ScraperKast when the operator registers.

### `credits`

The number of pages the token holder can access before the token is
effectively exhausted. The middleware checks `credits > 0` — it does not
decrement the count automatically (see [credit decrement](#credit-decrement)
below).

### `allowedDomains`

An array of domains the token is scoped to. An empty array (`[]`) means
the token is valid on any domain. This is checked at the payment server
level, not by the middleware itself.

### `exp`

Standard JWT expiry claim. Tokens are valid for **1 hour** from issuance.
After expiry, `verifyToken()` returns `null` and the bot must purchase a
new token.

---

## Token lifecycle

```
1. Bot hits your site without a token
         │
         ▼
   402 Payment Required
   { paymentUrl: "https://api.scraperkast.com/pay?bot=...&path=..." }
         │
         ▼
2. Bot operator visits paymentUrl, completes Stripe payment
         │
         ▼
3. ScraperKast payment server issues a signed JWT
   (signed with your shared jwtSecret)
         │
         ▼
4. Bot sends requests with Authorization: Bearer <token>
         │
         ▼
5. Middleware verifies signature + checks credits > 0
         │
         ▼
6. Bot gets 200 OK responses until credits = 0 or token expires (1 hour)
         │
         ▼
7. Bot gets 402 again → operator tops up → new token issued
```

Your server **never handles money directly**. The ScraperKast payment server
acts as the payment intermediary and signs tokens with your shared secret.

---

## `AuthService` API

```ts
import { AuthService } from '@scraperkast/core';

const auth = new AuthService(process.env.JWT_SECRET!);
```

### `generateToken(botId, credits, domains)`

Issues a signed token valid for **1 hour**.

```ts
const token = auth.generateToken(
  'openai-gptbot',  // botId
  500,              // credits — 500 page accesses
  ['example.com'],  // allowedDomains — empty array = unrestricted
);
// eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### `verifyToken(token)`

Returns the decoded `TokenPayload` or `null` if the token is invalid,
expired, or has a bad signature.

```ts
const payload = auth.verifyToken(token);

if (payload === null) {
  // Token invalid, expired, or signature mismatch
  return res.status(401).json({ error: 'Unauthorized' });
}

console.log(payload.botId);   // "openai-gptbot"
console.log(payload.credits); // 500
console.log(payload.exp);     // Unix timestamp
```

---

## How AI companies get tokens

The typical integration flow for a bot operator:

1. **Receive 402** — the bot parses the JSON body and extracts `paymentUrl`.
2. **Complete payment** — the operator visits `paymentUrl` and pays via
   Stripe (or another payment method the ScraperKast server supports).
3. **Receive token** — the payment server responds with a signed JWT.
4. **Configure the crawler** — the operator sets the `Authorization` header
   in their crawler:
   ```
   Authorization: Bearer eyJhbGci...
   ```
5. **Automatic renewal** — when credits reach zero or the token expires,
   the crawler receives a new 402 and repeats the flow.

This flow is fully machine-readable. A well-written crawler can handle the
entire lifecycle automatically without human intervention.

---

## Credit decrement

The middleware checks `credits > 0` but does **not** decrement the credit
count on each request. This is intentional — decrementing requires a
database write on every request, which adds latency and a single point of
failure.

**Recommended pattern:** use the `onAuthorized` callback to write events to
your own store and issue a new token (with `credits: 0` or without a valid
token) when the count is exhausted.

```ts
const creditStore = new Map<string, number>(); // replace with your database

app.use(scraperKast({
  jwtSecret: process.env.JWT_SECRET!,
  rules: [...],
  onAuthorized(req, botName) {
    const remaining = (creditStore.get(botName) ?? 500) - 1;
    creditStore.set(botName, remaining);

    if (remaining <= 0) {
      // Bot has used all credits — next request will need a new token
      // You can proactively notify the operator here
      console.log(`⚠️  ${botName} credits exhausted`);
    }
  },
}));
```

---

## Security best practices

### Use a strong secret

```bash
# Generate a cryptographically random 32-byte secret
openssl rand -base64 32
```

A weak secret (e.g. `"secret"` or `"password"`) allows anyone to forge
tokens. Use at least 32 random bytes.

### Rotate secrets periodically

When you rotate `jwtSecret`:
1. Update the environment variable on the ScraperKast payment server.
2. Update `JWT_SECRET` in your Express app and redeploy.
3. All existing tokens become invalid immediately — operators will see 402
   and need to purchase new tokens. Notify operators before rotating.

### Never log tokens

Tokens carry credit balances and identity claims. Treat them like passwords:

```ts
// ❌ Don't do this
console.log(`Token: ${req.headers.authorization}`);

// ✅ Log the decoded botId instead
onAuthorized(req, botName) {
  console.log(`Authorized: ${botName}`);
}
```

### Use HTTPS

JWT verification only proves the token is signed with your secret. Without
HTTPS, tokens can be intercepted in transit and replayed. Always serve your
Express app behind TLS in production.

### Scope tokens to domains

When issuing tokens, set `allowedDomains` to the specific domains the
operator has paid to access. This prevents a token purchased for
`site-a.com` from being used on `site-b.com`.

```ts
// Token issued for a single domain only
auth.generateToken('openai', 500, ['yourblog.com']);
```

### Set `httpOnly` on admin routes

If you expose an analytics or admin endpoint, protect it:

```ts
app.get('/internal/stats', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json(analytics.getStats());
});
```
