# Autonomous Bot Demo

Shows a fully autonomous AI agent that detects HTTP 402, pays on-chain, and retries — zero human involvement.

## What you'll see

```
════════════════════════════════════════════════════════════
  🤖  SCRAPERKAST — AUTONOMOUS AGENT DEMO
════════════════════════════════════════════════════════════
  Agent:   CustomAIBot/1.0
  Target:  http://localhost:3001/api/demo-content
  Network: Base Sepolia Testnet

📡  STEP 1: Requesting content...
    Response: 402 Payment Required

💳  STEP 2: HTTP 402 Payment Required detected!
    Amount:    0.01 USDC
    Recipient: 0xABC...

⛓️   STEP 3: Executing autonomous on-chain payment...
    ✅ Transaction submitted!
    ✅ Confirmed in block 14823901!

🔄  STEP 4: Retrying with payment proof...
    Response: 200 OK

🎉  SUCCESS — Content retrieved!
💰  Spent: 0.01 USDC
```

## Setup

### 1. Install dependencies

```bash
cd examples/autonomous-bot
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | Description |
|---|---|
| `BOT_PRIVATE_KEY` | Private key of a Base Sepolia wallet with USDC |
| `TARGET_URL` | Protected endpoint (default: `localhost:3001/api/demo-content`) |

### 3. Fund the bot wallet

You need two things on Base Sepolia:

- **ETH** (gas) → [Coinbase Faucet](https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet)
- **USDC** → [Circle Faucet](https://faucet.circle.com) (select Base Sepolia)

### 4. Configure the server

In `apps/dashboard/.env.local`, set the address that receives payments:

```env
DEMO_WALLET_ADDRESS=0xYour_Receiving_Wallet_Address
```

### 5. Start the dashboard

```bash
# From monorepo root
npm run dev
```

### 6. Run the demo

```bash
npm run demo
```

## How it works

1. **Bot identifies itself** via `User-Agent: CustomAIBot/1.0`
2. **Server returns HTTP 402** with payment instructions (recipient, amount, USDC address)
3. **Bot sends USDC** on-chain via viem `writeContract` → ERC-20 `transfer()`
4. **Bot waits** for `waitForTransactionReceipt` (1 block, ~2 seconds on Base Sepolia)
5. **Bot retries** with `X-Payment-Proof: <txHash>` header
6. **Server verifies** the tx on-chain, checks USDC Transfer event, serves content

## Wallet addresses needed

| Address | Purpose |
|---|---|
| Bot wallet | Sends USDC payments (needs USDC + ETH for gas) |
| Receiving wallet | Receives payments — set via `DEMO_WALLET_ADDRESS` in `.env.local` |

The receiving wallet is auto-displayed in the 402 response, so the bot reads it dynamically — no hardcoding needed.
