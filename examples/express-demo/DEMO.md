# ScraperKast — 5-Minute Demo Script

> **Before you record:** run through this once end-to-end without recording.
> Everything should take ~5 minutes at a relaxed speaking pace.

---

## Pre-flight checklist

```
□ Terminal font size ≥ 18 pt, high-contrast theme (dark bg)
□ Browser tabs closed / hidden — only the terminal is visible
□ Notifications silenced (macOS: Focus mode on)
□ `cd` into examples/express-demo in your terminal
□ Run: npm run dev   — confirm the server starts cleanly, then kill it (Ctrl-C)
□ Clear the terminal: clear
□ Have this file open in a second window you can glance at off-screen
```

---

## ─── 0:00 – 0:30 │ Introduction ───────────────────────────────────────────

**Screen:** Blank terminal, large font.

**Say:**

> "AI companies — OpenAI, Anthropic, Google — are training their models on web
> content right now, at a scale that makes robots.txt meaningless. Publishers
> get nothing.
>
> ScraperKast is an open-source middleware that changes that. You add five lines
> of code to your Express server, and from that moment on, every AI bot that
> hits your site gets a machine-readable price tag. They either pay, or they
> don't get in. Human visitors never see a thing.
>
> It's the open-source alternative to TollBit. MIT licensed, no vendor lock-in.
> Let me show you how it works."

**Timing check:** You should finish this around **0:28–0:32**. Speed up slightly
if behind; slow down if ahead — this section sets the tone.

---

## ─── 0:30 – 1:30 │ Installation & Setup ────────────────────────────────────

**Screen:** Terminal, root of a fresh project directory.

### Step 1 — Install (type slowly, let it run)

```bash
npm install @scraperkast/middleware-express
```

**Say while it installs:**

> "One package. It pulls in the core bot-detection engine, the pricing
> system, and the JWT auth layer automatically."

---

### Step 2 — Show the setup code

Open your editor and show this file (or paste it in the terminal with `cat`):

```bash
cat src/server.ts
```

**Point to each block as you speak:**

```
import express from 'express';
import { scraperKast } from '@scraperkast/middleware-express';

const app = express();
```

> "Standard Express setup — nothing unusual yet."

```
app.use(scraperKast({
  jwtSecret: process.env.JWT_SECRET,
  rules: [
    { id: 'blog',    path: '/blog/*',      pricePerPage: 100,  licenseType: 'summarization' },
    { id: 'apidocs', path: '/docs/api/*',  pricePerPage: 500,  licenseType: 'full_display'  },
    { id: 'premium', path: '/premium/*',   pricePerPage: 1000, licenseType: 'full_display'  },
  ],
}));
```

> "This is the entire integration. Three pricing rules. `pricePerPage` is in
> micro-dollars — 100 means one tenth of a cent, $0.001. Your routes live
> below this and don't change at all."

---

### Step 3 — Start the server

```bash
npm run dev
```

**Say:**

> "And we're live. You can see the routes and their prices right in the
> startup banner."

**Timing check:** You should be at **~1:25** when the server is running.
If you're ahead, ad-lib a sentence about the startup banner.

---

## ─── 1:30 – 2:00 │ Human Request ──────────────────────────────────────────

**Screen:** New terminal tab (keep the server tab visible if you can split).

**Say:**

> "Let's start with a normal human visitor. I'll use curl with a real
> browser User-Agent — Chrome on macOS."

```bash
curl -s \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36" \
  http://localhost:3000/blog/intro-to-llms \
  | python3 -m json.tool
```

**Expected output (truncated for the camera):**

```json
{
    "slug": "intro-to-llms",
    "title": "Introduction to Large Language Models",
    "author": "Ada Lovelace",
    ...
}
```

**Say:**

> "200 OK. The middleware looked at the User-Agent, didn't recognise a bot,
> and passed the request straight through to the route handler. Zero
> overhead for your real users."

**Also point to the server tab — it should log:**

```
👤 HUMAN  GET  /blog/intro-to-llms
```

**Timing check:** Hit **2:00** as you finish this sentence.

---

## ─── 2:00 – 3:00 │ AI Bot Request ─────────────────────────────────────────

**Screen:** Same terminal tab.

**Say:**

> "Now let's be GPTBot — OpenAI's training crawler."

```bash
curl -s \
  -H "User-Agent: GPTBot/1.0 (+https://openai.com/gptbot)" \
  http://localhost:3000/blog/intro-to-llms \
  | python3 -m json.tool
```

**Expected output:**

```json
{
    "error": "Payment Required",
    "bot": "OpenAI GPTBot",
    "pricing": {
        "pricePerPage": 100,
        "currency": "USD"
    },
    "paymentUrl": "https://api.scraperkast.com/pay?bot=OpenAI+GPTBot&path=%2Fblog%2Fintro-to-llms",
    "documentation": "https://docs.scraperkast.com"
}
```

**Point at each field as you speak:**

> "`error: Payment Required` — that's HTTP 402. Machine-readable, so a bot
> can parse it automatically.
>
> `bot` — we've identified exactly which bot this is.
>
> `pricing.pricePerPage: 100` — that's $0.001. One tenth of a cent to read
> this blog post.
>
> `paymentUrl` — the bot operator clicks this, pays via Stripe, and gets
> back a signed JWT. From then on their crawler sends that token on every
> request and gets through automatically.
>
> The site owner never touches a payment processor. ScraperKast handles
> the whole transaction."

**Also point to the server tab:**

```
💰 PAYMENT REQUIRED  OpenAI GPTBot  →  /blog/intro-to-llms
```

> "And in the server logs — colour-coded, you can see every bot that tried
> to access your content."

**Timing check:** You should be at **~2:55** finishing this explanation.

---

## ─── 3:00 – 4:00 │ Path-Based Pricing ─────────────────────────────────────

**Screen:** Same terminal tab.

**Say:**

> "Now let me show the pricing tiers. Different content, different prices."

**Command 1 — Blog ($0.001):**

```bash
curl -s \
  -H "User-Agent: PerplexityBot/1.0" \
  http://localhost:3000/blog/transformer-architecture \
  | python3 -c "import sys,json; d=json.load(sys.stdin); p=d['pricing']; print(f\"  {d['bot']}  →  \${p['pricePerPage']/100000:.4f} per page\")"
```

**Expected:**

```
  Perplexity PerplexityBot  →  $0.0010 per page
```

**Command 2 — API Docs ($0.005):**

```bash
curl -s \
  -H "User-Agent: PerplexityBot/1.0" \
  http://localhost:3000/docs/api/authentication \
  | python3 -c "import sys,json; d=json.load(sys.stdin); p=d['pricing']; print(f\"  {d['bot']}  →  \${p['pricePerPage']/100000:.4f} per page\")"
```

**Expected:**

```
  Perplexity PerplexityBot  →  $0.0050 per page
```

**Command 3 — Premium ($0.01):**

```bash
curl -s \
  -H "User-Agent: PerplexityBot/1.0" \
  http://localhost:3000/premium/data \
  | python3 -c "import sys,json; d=json.load(sys.stdin); p=d['pricing']; print(f\"  {d['bot']}  →  \${p['pricePerPage']/100000:.4f} per page\")"
```

**Expected:**

```
  Perplexity PerplexityBot  →  $0.0100 per page
```

**Say after all three:**

> "Blog posts: $0.001. Technical API documentation: $0.005 — five times
> more, because it's more valuable to train on. Premium research data:
> $0.01 per page.
>
> You define these rules. Wildcard paths, per-bot overrides, global
> fallbacks — the pricing engine picks the most specific rule that matches."

**Now show a bot blocked entirely (no rule for this path):**

```bash
curl -s \
  -H "User-Agent: GPTBot/1.0" \
  http://localhost:3000/ \
  | python3 -m json.tool
```

**Expected:**

```json
{
    "error": "Forbidden",
    "message": "Bot \"OpenAI GPTBot\" is not permitted to access /"
}
```

**Say:**

> "And if a path has no pricing rule at all, the bot gets a 403. You're
> not saying 'pay me' — you're saying 'this route isn't for you.' Full
> control."

**Timing check:** You should be at **~3:58** finishing this section.

---

## ─── 4:00 – 4:30 │ Authorised Bot (JWT) ───────────────────────────────────

**Screen:** Same terminal tab.

**Say:**

> "Let me show the other side — what happens once a bot has paid and has
> a valid token."

**Pre-generated demo token (valid for 1 hour from the time this script was written —
regenerate if expired):**

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJib3RJZCI6ImRlbW8tb3BlbmFpIiwiY3JlZGl0cyI6NTAsImFsbG93ZWREb21haW5zIjpbXSwiaWF0IjoxNzczOTQwMTUwLCJleHAiOjE3NzM5NDM3NTB9.CWWMY-zYrHG1SLR1wpbi8LzFoAr9wrbRu3S9rr5z5hA
```

> **If the token is expired, regenerate with:**
> ```bash
> node --input-type=module <<'EOF'
> import { AuthService } from '@scraperkast/core';
> const s = new AuthService('dev-secret-change-in-production');
> console.log(s.generateToken('demo-openai', 50, []));
> EOF
> ```

**Run the authorised request:**

```bash
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJib3RJZCI6ImRlbW8tb3BlbmFpIiwiY3JlZGl0cyI6NTAsImFsbG93ZWREb21haW5zIjpbXSwiaWF0IjoxNzczOTQwMTUwLCJleHAiOjE3NzM5NDM3NTB9.CWWMY-zYrHG1SLR1wpbi8LzFoAr9wrbRu3S9rr5z5hA"

curl -s \
  -H "User-Agent: GPTBot/1.0 (+https://openai.com/gptbot)" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/blog/intro-to-llms \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  title:', d['title']); print('  author:', d['author'])"
```

**Expected:**

```
  title: Introduction to Large Language Models
  author: Ada Lovelace
```

**Point to the server tab — it should log:**

```
✅ AUTHORIZED  OpenAI GPTBot  →  /blog/intro-to-llms
```

**Say:**

> "200 OK. The middleware verified the JWT signature, checked that credits
> are greater than zero, and let the request through. Your route handler
> ran normally — it doesn't even know a bot was involved.
>
> The token payload carries the bot's identity, a credit balance, and an
> expiry. When credits hit zero, the next request gets a 402 again and the
> operator tops up."

**Timing check:** You should be at **~4:28** finishing this section.

---

## ─── 4:30 – 5:00 │ Conclusion ────────────────────────────────────────────

**Screen:** Switch to your editor and show the `package.json` install line,
or just type in the terminal.

**Say:**

> "That's ScraperKast. Five lines of middleware, three pricing rules, and
> your content is protected.
>
> It's open source, MIT licensed — use it commercially, fork it, contribute
> to it. No vendor lock-in, no monthly fee to us.

**Type slowly in the terminal:**

```bash
npm install @scraperkast/middleware-express
```

> "One command to get started.
>
> If this is useful to you, a GitHub star genuinely helps — it's what
> keeps open-source projects alive.
>
> Link in the description. Thanks for watching."

**Timing check:** Land on **5:00 ± 10 seconds**.

---

## Timing overview

| Section | Start | End | Duration |
|---|---|---|---|
| Introduction | 0:00 | 0:30 | 30 s |
| Installation & setup | 0:30 | 1:30 | 60 s |
| Human request | 1:30 | 2:00 | 30 s |
| AI bot / 402 | 2:00 | 3:00 | 60 s |
| Path-based pricing | 3:00 | 4:00 | 60 s |
| Authorised bot / JWT | 4:00 | 4:30 | 30 s |
| Conclusion | 4:30 | 5:00 | 30 s |

---

## Recording tips

### Terminal setup
- **Font size:** 18–20 pt minimum. Viewers on mobile will thank you.
- **Line width:** Keep lines under ~80 chars so nothing wraps off-screen.
- **Theme:** Dark background (Dracula, One Dark, or Tokyo Night). Avoid
  pure white terminals — the ANSI colours from the middleware logs pop much
  better on dark backgrounds.
- **Shell prompt:** Shorten it. Set `PS1='$ '` before recording so the
  prompt doesn't eat screen space.
- **Split pane:** Run the server in the left pane, curl commands in the
  right. Your audience can see the server logs react in real time — this
  is more compelling than switching tabs.

### What to show
- ✅ The coloured server logs (💰 / ✅ / 👤) — these are visual proof the
  middleware is doing real work.
- ✅ The 402 JSON body — keep it on screen for 3–4 seconds so viewers
  can read it.
- ✅ The `src/server.ts` pricing rules block — show this before starting
  the server so the rules are fresh in the viewer's mind when you demo them.
- ✅ The `npm install` line at the start and end — bookends the demo
  with the actionable step.

### What to hide
- ❌ Your file system tree / other projects
- ❌ Any `.env` file with a real secret
- ❌ Email, Slack, browser history, bookmarks bar
- ❌ Full terminal scrollback — `clear` between major sections

### Pacing
- **Type slowly** — 50–60% of your normal typing speed. Fast typing is
  hard to follow and makes the demo feel rushed.
- **Pause after each command** — let the output appear and sit on screen
  for 1–2 seconds before speaking over it.
- **Don't fill silence** — silence while output renders is fine. Viewers
  are reading. "Umm" and "so" are more distracting.

### Re-takes
The natural cut points are at the section breaks (every ~30–60 s). If you
flub a command, stop, say "let me redo that", and cut that segment in
editing. You don't need a single perfect take.

---

## Quick-reference command sheet

> Paste this into a scratchpad you keep off-screen during recording.

```bash
# ── Start server ──────────────────────────────────────────
npm run dev

# ── Human request ─────────────────────────────────────────
curl -s \
  -H "User-Agent: Mozilla/5.0 (Macintosh) Chrome/124.0" \
  http://localhost:3000/blog/intro-to-llms | python3 -m json.tool

# ── Bot, no token → 402 ───────────────────────────────────
curl -s \
  -H "User-Agent: GPTBot/1.0 (+https://openai.com/gptbot)" \
  http://localhost:3000/blog/intro-to-llms | python3 -m json.tool

# ── Pricing tiers ─────────────────────────────────────────
# Blog   $0.001
curl -s -H "User-Agent: PerplexityBot/1.0" \
  http://localhost:3000/blog/transformer-architecture \
  | python3 -c "import sys,json; d=json.load(sys.stdin); p=d['pricing']; print(f\"  {d['bot']}  →  \${p['pricePerPage']/100000:.4f}\")"

# Docs   $0.005
curl -s -H "User-Agent: PerplexityBot/1.0" \
  http://localhost:3000/docs/api/authentication \
  | python3 -c "import sys,json; d=json.load(sys.stdin); p=d['pricing']; print(f\"  {d['bot']}  →  \${p['pricePerPage']/100000:.4f}\")"

# Premium $0.01
curl -s -H "User-Agent: PerplexityBot/1.0" \
  http://localhost:3000/premium/data \
  | python3 -c "import sys,json; d=json.load(sys.stdin); p=d['pricing']; print(f\"  {d['bot']}  →  \${p['pricePerPage']/100000:.4f}\")"

# No rule → 403
curl -s -H "User-Agent: GPTBot/1.0" \
  http://localhost:3000/ | python3 -m json.tool

# ── Regenerate JWT (if pre-generated token expired) ───────
node --input-type=module <<'EOF'
import { AuthService } from '@scraperkast/core';
const s = new AuthService('dev-secret-change-in-production');
console.log(s.generateToken('demo-openai', 50, []));
EOF

# ── Bot with token → 200 ──────────────────────────────────
TOKEN="<paste token here>"
curl -s \
  -H "User-Agent: GPTBot/1.0 (+https://openai.com/gptbot)" \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/blog/intro-to-llms \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  title:', d['title'])"
```
