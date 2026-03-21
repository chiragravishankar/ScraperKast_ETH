# Self-Hosting

ScraperKast is free to self-host. This guide covers environment setup,
Docker deployment, and a production checklist.

→ [Configuration](./configuration.md) · [Authentication](./authentication.md)

---

## How self-hosting works

ScraperKast has two distinct components:

| Component | What it is | Self-hostable? |
|---|---|---|
| **Express middleware** | npm package you add to your app | ✅ Always — it's just code |
| **Payment server** | Handles Stripe payments, issues JWTs | ✅ Yes — or use the hosted service |

The middleware (`@scraperkast/middleware-express`) is always self-hosted —
it runs inside your Express app. The payment server (which issues tokens
after bots pay) can either be:

- **Hosted by ScraperKast** (free tier available) — zero config, you just
  set `JWT_SECRET` in both your app and the hosted server.
- **Self-hosted** — run your own payment server using the ScraperKast
  payment server code (open source, coming soon).

For most developers, using the hosted payment server is the right choice
until you need custom payment flows or data sovereignty.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `JWT_SECRET` | **Yes** | HMAC-SHA256 secret shared with the payment server. At least 32 random characters. |
| `PORT` | No | Port to listen on. Default: `3000`. |
| `NODE_ENV` | No | Set to `production` to enable production optimisations in Express. |

**Generate a strong `JWT_SECRET`:**

```bash
openssl rand -base64 32
```

**`.env.example`** (copy to `.env` for local development):

```bash
JWT_SECRET=change-this-to-a-long-random-string-in-production
PORT=3000
NODE_ENV=development
```

---

## Local development

```bash
git clone https://github.com/chiragravishankar/scraperkast.git
cd scraperkast
npm install

# Build all packages
npm run build --workspaces --if-present

# Run the demo app
cd examples/express-demo
cp .env.example .env   # set JWT_SECRET
npm run dev            # starts on http://localhost:3000
```

---

## Docker deployment

### `Dockerfile` for your app

This example assumes you have an Express app at the repo root that uses
`@scraperkast/middleware-express`.

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app

# ── Install dependencies ──────────────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Build ─────────────────────────────────────────────────────────────────────
FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Production image ──────────────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production

COPY --from=deps  /app/node_modules ./node_modules
COPY --from=build /app/dist         ./dist
COPY package.json ./

EXPOSE 3000
CMD ["node", "dist/server.js"]
```

Build and run:

```bash
docker build -t my-scraperkast-app .

docker run -d \
  --name scraperkast \
  -p 3000:3000 \
  -e JWT_SECRET="$(openssl rand -base64 32)" \
  -e NODE_ENV=production \
  my-scraperkast-app
```

### `docker-compose.yml`

```yaml
version: '3.9'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      JWT_SECRET: ${JWT_SECRET}
      NODE_ENV: production
      PORT: 3000
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

```bash
# Set the secret in your shell or in a .env file
export JWT_SECRET="$(openssl rand -base64 32)"
docker compose up -d
```

### Add a health check endpoint

The Docker healthcheck above hits `/health`. Add it to your app:

```ts
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
```

---

## Deploying with a reverse proxy (nginx)

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate     /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Production checklist

### Security

- [ ] `JWT_SECRET` is at least 32 random characters (`openssl rand -base64 32`)
- [ ] `JWT_SECRET` is loaded from an environment variable, not hardcoded
- [ ] `JWT_SECRET` is stored in a secrets manager (AWS Secrets Manager,
      Vault, Doppler) in production
- [ ] App is served over HTTPS (TLS certificate installed)
- [ ] `/internal/stats` and any admin endpoints are protected
      (`x-admin-key` header or IP allowlist)
- [ ] `NODE_ENV=production` is set (disables Express stack traces in responses)

### Reliability

- [ ] Health check endpoint exists (`GET /health → 200`)
- [ ] App restarts on crash (Docker `restart: unless-stopped`, pm2, systemd)
- [ ] Process manager logs to a persistent location
- [ ] Memory usage is monitored — `enableAnalytics: true` grows unboundedly
      (see [Analytics — Memory usage](./analytics.md#memory-usage))

### Configuration

- [ ] `enableAnalytics` is set to `false` unless you have a persistence
      strategy for events
- [ ] All `PricingRule` ids are unique
- [ ] A global fallback rule exists if you want all bots to get a 402
      (not a 403) on uncovered paths
- [ ] `onAuthorized` callback handles errors internally (never throw)

### Monitoring

- [ ] Application logs are forwarded to a log aggregator (CloudWatch,
      Datadog, Logtail, etc.)
- [ ] Alerts are set on unexpected 5xx error rates
- [ ] Optional: pipe `onPaymentRequired` events to a metrics service
      (Prometheus, StatsD) to track 402 volume

### Before going live

- [ ] Run `npm run build --workspaces` and `npm test --workspaces` clean
- [ ] Test with `curl` using a bot User-Agent to confirm 402 is returned
- [ ] Test with a valid JWT to confirm bots with tokens get through
- [ ] Test with a human User-Agent to confirm `next()` is called (no overhead)
- [ ] Rotate `JWT_SECRET` once after initial deployment to confirm rotation
      procedure works

---

## Scaling

ScraperKast middleware is **stateless** — it holds no shared state between
requests (the `PricingEngine` and `AuthService` are instantiated once at
startup and are read-only after that). You can run as many instances as you
need behind a load balancer with no coordination.

The only exception is `enableAnalytics: true` — the in-memory collector is
local to each process. Use the `onAuthorized` / `onPaymentRequired`
callbacks to write events to a shared database instead.
