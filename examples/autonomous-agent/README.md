# ScraperKast — Autonomous Payment Agent

An autonomous AI agent that demonstrates the complete ScraperKast micropayment
flow end-to-end **without any human input**.

```
🤖 Agent discovers protected content
❌ Receives 402 Payment Required
💭 Makes autonomous pay/skip decision
💳 Executes real USDC payment on Solana devnet
🎫 Receives JWT access token
📄 Successfully retrieves content
✅ Full flow in ~2–4 seconds
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| npm | ≥ 9 | bundled with Node |

**No Phantom wallet. No credit card. No manual steps after setup.**

---

## Quick Start

### Step 1 — Install & Setup

```bash
cd examples/autonomous-agent
npm install
npm run setup
```

`setup` will:
- Generate a Solana keypair for the agent
- Airdrop 2 SOL from the devnet faucet
- Create a custom SPL token (test-USDC) and mint you 10 test-USDC
- Write a `.env` file with all required configuration

> **Note:** The devnet faucet rate-limits at ~2 requests/minute. If airdrop
> fails, wait 60 seconds and re-run, or fund manually at
> https://faucet.solana.com

### Step 2 — Start the dashboard

In a separate terminal:

```bash
cd apps/dashboard
npm run dev
# Runs on http://localhost:3000
```

### Step 3 — Run the agent

```bash
npm start
```

### One-command demo (starts everything automatically)

```bash
bash demo.sh
```

The demo script:
1. Checks prerequisites
2. Runs `npm run setup` if `.env` is missing
3. Starts the dashboard if it's not already running
4. Launches the agent with full live output
5. Saves everything to `demo.log`

---

## Expected Output

```
══════════════════════════════════════════════════════════════
  🤖  ScraperKast Autonomous Payment Agent
  Proving end-to-end AI micropayment infrastructure
══════════════════════════════════════════════════════════════

─────────────────── AGENT INITIALISATION ──────────────────────
  Wallet address       7xKX...9mPq
  SOL balance          1.9850 SOL
  USDC balance         10,000,000 µUSDC ($10.0000)
  Goal                 Find and access content about AI trends
  Max price            10,000 µUSDC

─────────────────── CONTENT DISCOVERY ─────────────────────────
[AGENT] Goal: Find and access content about AI trends
[AGENT] Discovered URL: http://localhost:3000/api/test-content
[AGENT] Making initial GET request…
[INFO ] Response status: 402

─────────────────── PAYMENT CHALLENGE RECEIVED (402) ──────────
  Price:               1,000 µUSDC ($0.000001)
  Currency:            USDC
  Wallet:              Abc1...XyZ2
  Content:             "Latest AI trends and analysis"
  Network:             devnet

─────────────────── AUTONOMOUS DECISION ENGINE ─────────────────
  Agent goal:          Find and access content about AI trends
  Content:             "Latest AI trends and analysis"
  Price:               1,000 µUSDC ($0.0010)
  Balance:             10,000,000 µUSDC
  Relevance:           HIGH (67%)
  Affordability:       AFFORDABLE

[💭] ✅ PROCEED WITH PAYMENT

─────────────────── SOLANA PAYMENT EXECUTION ───────────────────
[💳] Sending 1,000 µUSDC to Abc1…XyZ2…
[💳] Building SPL-token transfer transaction…
[⛓️] Creating/fetching sender token account…
[⛓️] Creating/fetching recipient token account…
[✅] Transaction submitted: 4xF8...Hy2K
[⛓️] ⏳ Waiting for on-chain confirmation…
[✅] ✅ Payment confirmed in 412ms
  Explorer:            https://explorer.solana.com/tx/4xF8...?cluster=devnet

─────────────────── ACCESS TOKEN RETRIEVAL ─────────────────────
[🎫] Submitting tx signature to ScraperKast…
[✅] JWT token received (312 chars)
  Token preview:       eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…

─────────────────── AUTHENTICATED CONTENT ACCESS ───────────────
[📄] Making authenticated GET request…
  Authorization:       Bearer [JWT]
[✅] ✅ Content retrieved successfully (HTTP 200)
  Title:               AI Trends 2026
  Author:              ScraperKast Research
  Date:                2026-04-21
[📄] Preview: "AI Trends Report 2026: The rise of autonomous agents in Web3…"

══════════════════════════════════════════════════════════════
  📊  MISSION COMPLETE
══════════════════════════════════════════════════════════════
  Total time:          1,847ms
  Cost paid:           1,000 µUSDC ($0.000001)
  Settlement:          Solana devnet
  Tx signature:        4xF8rTy9...
  Status:              COMPLETED
══════════════════════════════════════════════════════════════
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Autonomous Agent                       │
│                                                         │
│  src/agent.ts      ← Main orchestration loop            │
│  src/decision.ts   ← Autonomous pay/skip logic          │
│  src/wallet.ts     ← Solana keypair + USDC transfers    │
│  src/logger.ts     ← Chalk-coloured demo logging        │
│  src/setup.ts      ← One-time wallet/mint setup         │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTP
                  ▼
┌─────────────────────────────────────────────────────────┐
│              ScraperKast Dashboard (Next.js)             │
│                                                         │
│  GET  /api/test-content        ← 402 or 200             │
│  POST /api/test-content/verify ← tx sig → JWT           │
└─────────────────┬───────────────────────────────────────┘
                  │ Solana RPC
                  ▼
┌─────────────────────────────────────────────────────────┐
│                   Solana Devnet                          │
│                                                         │
│  SPL token transfer (USDC)                              │
│  Confirmed in ~400ms                                    │
└─────────────────────────────────────────────────────────┘
```

---

## Payment Flow

```
Agent                        Dashboard                  Solana Devnet
  │                              │                           │
  │─── GET /api/test-content ───▶│                           │
  │◀── 402 { price, wallet } ───│                           │
  │                              │                           │
  │──────── SPL token transfer ──────────────────────────────▶│
  │◀──────── tx signature ───────────────────────────────────│
  │                              │                           │
  │─ POST /verify { signature } ▶│                           │
  │                              │── getTransaction(sig) ───▶│
  │                              │◀── confirmed ─────────────│
  │◀─── { token: "eyJ..." } ────│                           │
  │                              │                           │
  │─── GET /api/test-content ───▶│                           │
  │    Authorization: Bearer jwt │                           │
  │◀─── 200 { content } ────────│                           │
```

---

## Environment Variables

| Variable | Description | Set by |
|----------|-------------|--------|
| `AGENT_PRIVATE_KEY` | Agent's Solana keypair (JSON byte array) | `npm run setup` |
| `AGENT_WALLET_ADDRESS` | Agent's public key | `npm run setup` |
| `PLATFORM_WALLET_ADDRESS` | Payment recipient address | `npm run setup` |
| `USDC_MINT` | Test-USDC SPL token mint address | `npm run setup` |
| `SOLANA_RPC` | Solana RPC endpoint | `.env.example` |
| `TARGET_ENDPOINT` | Protected content URL | `.env.example` |
| `VERIFY_ENDPOINT` | Token verification URL | `.env.example` |
| `AGENT_GOAL` | Natural language goal for decision logic | `.env.example` |
| `MAX_PRICE_USDC` | Max µUSDC the agent will spend | `.env.example` |

---

## Troubleshooting

**"AGENT_PRIVATE_KEY not set"**
→ Run `npm run setup` to generate the wallet and `.env` file.

**"USDC_MINT not set"**
→ Run `npm run setup`. This creates the custom test-USDC mint.

**"Airdrop failed — rate limited"**
→ Wait 60 seconds and re-run setup, or fund manually:
  https://faucet.solana.com

**"Cannot reach http://localhost:3000"**
→ Start the dashboard: `cd apps/dashboard && npm run dev`

**"Transaction not confirmed"**
→ Devnet can occasionally be slow. The verify endpoint retries 5×.
  Re-run the agent — it will create a new transaction.

**Agent says "SKIP" instead of paying**
→ The decision engine found low content-goal relevance.
  Either adjust `AGENT_GOAL` in `.env` or increase `MAX_PRICE_USDC`
  to force payment regardless of relevance.

---

## Recording a Demo Video

```bash
# 1. Run a clean demo
bash demo.sh

# 2. Capture with QuickTime (macOS)
#    File → New Screen Recording → select terminal window

# 3. Or use asciinema for a terminal-only recording:
brew install asciinema
asciinema rec demo.cast
npm start
# Ctrl+D to stop
asciinema play demo.cast
```

The full agent output is always saved to `demo.log` for reference.

---

## Extending the Agent

| Enhancement | Where to edit |
|-------------|---------------|
| LLM-powered relevance scoring | `src/decision.ts` → `scoreRelevance()` |
| Multiple content sources | `src/agent.ts` → `discoverContent()` |
| Retry on failure / budget limits | `src/agent.ts` → `run()` |
| Real USDC on mainnet | Change `SOLANA_NETWORK=mainnet` in `.env` |
| Stripe payment fallback | `src/agent.ts` → `executePayment()` |
