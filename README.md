# ScraperKast - Autonomous AI Agent Payment Infrastructure

**Monetize AI bot traffic with HTTP 402 and autonomous blockchain payments**

---

## 🎯 One-Liner

The first platform that lets publishers charge AI agents per-page using HTTP 402, autonomous on-chain payments, and multi-token support via Uniswap — ending the free-lunch era for GPT, Claude, and 200+ other AI scrapers.

---

## 🔥 The Problem

**AI agents are scraping the web for free.**

- 200+ AI bots (GPTBot, ClaudeBot, Perplexity) crawl millions of pages daily
- Publishers spend $$$$ on infrastructure to serve bot traffic
- Zero revenue from bots → subsidizing AI training with hosting costs
- Traditional paywalls don't work (agents can't fill forms)
- Robots.txt is a suggestion, not enforcement

**Publishers need a way to charge bots that actually works.**

---

## ✨ The Solution

**ScraperKast = HTTP 402 + KeeperHub + Uniswap**

1. **Detect AI bots** - 200+ agent signatures (GPTBot, ClaudeBot, etc.)
2. **Return HTTP 402** - "Payment Required" with autonomous payment instructions
3. **Accept any token** - Bots pay in ETH, USDC, DAI, or 20+ ERC-20s via Uniswap
4. **Auto-convert to USDC** - Revenue credited instantly to publisher wallet
5. **Withdraw anytime** - Publishers withdraw to their personal wallet on Base Sepolia

**No forms. No APIs to integrate. Just autonomous payments.**

---

## 🏗️ Architecture

```
┌─────────────┐
│  AI Agent   │ (GPTBot, Claude, etc.)
└──────┬──────┘
       │ GET /article
       ▼
┌─────────────────────┐
│  ScraperKast CDN    │ ← Middleware detects bot
└──────┬──────────────┘
       │ Is bot? → Yes
       ▼
┌─────────────────────┐
│   HTTP 402          │ ← Payment instructions
│   KeeperHub x402    │   • Pay to publisher wallet
│   + Uniswap quote   │   • Any token → USDC swap
└──────┬──────────────┘
       │ Agent executes payment
       ▼
┌─────────────────────┐
│   Blockchain        │ ← On-chain verification
│   Base Sepolia      │   • Validate tx hash
└──────┬──────────────┘
       │ Payment verified
       ▼
┌─────────────────────┐
│   Content Served    │ ← Agent gets content
│   + Balance Updated │   Publisher earns $$$
└─────────────────────┘
```

**Key Innovation:** Each user gets an auto-generated smart wallet. Bots pay directly to it. No shared hot wallet, no custody risk.

---

## 🛠️ Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase Auth

**Backend:**
- Prisma ORM (PostgreSQL)
- viem (Ethereum interactions)
- Next.js API Routes

**Blockchain:**
- Base Sepolia (primary testnet)
- Sepolia (fallback)
- Smart wallet system (deterministic per-user)

**Integrations:**
- **KeeperHub** - x402 protocol for autonomous payments
- **Uniswap V3** - Multi-token support with auto-conversion
- Base Sepolia USDC (0x036CbD53842c5426634e7929541eC2318f3dCF7e)

---

## 🚀 Quick Start

### Prerequisites

```bash
Node.js 18+
PostgreSQL database
Base Sepolia testnet ETH
Base Sepolia testnet USDC
```

### Installation

```bash
# Clone repo
git clone https://github.com/YOUR_USERNAME/ScraperKast_ETH.git
cd ScraperKast_ETH

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your values (see .env.example for details)

# Set up database
npx prisma db push
npx prisma generate

# Run development server
npm run dev --workspace=@scraperkast/dashboard
```

### Environment Variables

See `.env.example` for complete list. Key variables:

```env
# Database
DATABASE_URL="postgresql://..."

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="xxx"

# Base Sepolia RPC
NEXT_PUBLIC_BASE_SEPOLIA_RPC="https://sepolia.base.org"

# Smart Wallet Encryption
WALLET_ENCRYPTION_KEY="your-32-char-key"
```

**⚠️ Security:** Never commit `.env` files! All secrets use testnet keys only.

---

## 📊 Features

### ✅ Implemented

- [x] AI bot detection (200+ agents)
- [x] HTTP 402 Payment Required responses
- [x] KeeperHub x402 protocol integration
- [x] Uniswap V3 swap quotes
- [x] Multi-token payment acceptance (ETH, USDC, DAI, WETH, etc.)
- [x] Auto-generated smart wallet per user
- [x] On-chain payment verification
- [x] Real-time revenue dashboard
- [x] Transaction history with blockchain proofs
- [x] Withdrawal flow to personal wallet
- [x] Bot rule customization (whitelist/pricing per bot)

### 🎨 UI Highlights

- **Purple gradient wallet** - Professional, crypto-native design
- **Revenue analytics** - Real-time charts and metrics
- **Transaction explorer** - Direct links to Base Sepolia block explorer
- **Mobile responsive** - Works on all devices

---

## 🤖 AI Tool Usage

This project was developed with assistance from AI tools during the ETHGlobal Online Hackathon (April 29 - May 3, 2026).

### Tools Used:
- **Claude Code** (Anthropic) - Full-stack development assistance
  - Database schema design
  - API endpoint implementation
  - Frontend component development
  - Smart contract integration logic
  
- **Claude (claude.ai)** - Project planning and architecture
  - System architecture decisions
  - Integration strategy
  - Documentation writing
  - Code review and debugging

### Human Contribution:
- Product vision and requirements definition
- Integration testing and debugging
- UX decisions and design direction
- Blockchain integration research
- Final testing and deployment

**All code was reviewed, tested, and debugged by the development team.** AI tools were used as coding assistants, not autonomous developers.

---

---

## 📂 Project Structure

```
scraperkast/
├── apps/
│   └── dashboard/           # Main Next.js app
│       ├── app/            # Next.js 14 app router
│       │   ├── api/        # API routes
│       │   ├── dashboard/  # Dashboard pages
│       │   └── auth/       # Auth pages
│       ├── lib/            # Core libraries
│       │   ├── middleware/ # x402 + Uniswap
│       │   └── wallet/     # Smart wallet system
│       └── prisma/         # Database schema
├── .env.example            # Environment template
├── README.md               # This file
├── FEEDBACK_KEEPERHUB.md   # KeeperHub feedback
└── FEEDBACK_UNISWAP.md     # Uniswap feedback
```

---

## 📜 License

MIT License

---

## 📞 Contact

**Developer:** Chirag Ravishankar  
**Email:** chiragravishankar@gmail.com

---

**Built with ❤️ during ETHGlobal Online Hackathon 2026**
