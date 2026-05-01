#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────────
# ScraperKast × KeeperHub — ETHGlobal Demo Script
# Autonomous AI agent paying for content via x402 on Ethereum Sepolia
# ────────────────────────────────────────────────────────────────────────────

set -e

CYAN="\033[0;36m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BOLD="\033[1m"
RESET="\033[0m"

header() {
  echo ""
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════════${RESET}"
  echo -e "${CYAN}${BOLD}  $1${RESET}"
  echo -e "${CYAN}${BOLD}══════════════════════════════════════════════════════════${RESET}"
  echo ""
}

step() {
  echo -e "${YELLOW}${BOLD}▶ $1${RESET}"
}

success() {
  echo -e "${GREEN}${BOLD}✅ $1${RESET}"
}

warn() {
  echo -e "${YELLOW}⚠️  $1${RESET}"
}

err() {
  echo -e "${RED}${BOLD}❌ $1${RESET}"
}

# ── Preamble ──────────────────────────────────────────────────────────────────

header "ScraperKast × KeeperHub — Autonomous Payment Agent"
echo -e "  ${BOLD}ETHGlobal Hackathon 2026 — x402 Payment Rail Demo${RESET}"
echo -e "  Ethereum Sepolia · KeeperHub execution layer"
echo ""
echo -e "  This demo shows an AI agent autonomously:"
echo -e "    1. Discovering paywalled content (HTTP 402)"
echo -e "    2. Deciding whether the content is worth paying for"
echo -e "    3. Routing the micropayment through KeeperHub"
echo -e "    4. Receiving a JWT and accessing the content"
echo ""

# ── Pre-flight checks ─────────────────────────────────────────────────────────

step "Running pre-flight checks…"

# Check Node.js
if ! command -v node &>/dev/null; then
  err "Node.js not found. Install from https://nodejs.org (requires v18+)"
  exit 1
fi

NODE_VER=$(node --version | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node.js v18+ required (found v$NODE_VER)"
  exit 1
fi
echo "  Node.js v$NODE_VER ✓"

# Check .env
if [ ! -f .env ]; then
  err ".env not found. Run: npm run setup"
  exit 1
fi
echo "  .env found ✓"

# Source .env for checks
set -a
# shellcheck disable=SC1091
source .env
set +a

# Check AGENT_PRIVATE_KEY
if [ -z "${AGENT_PRIVATE_KEY:-}" ]; then
  err "AGENT_PRIVATE_KEY not set in .env. Run: npm run setup"
  exit 1
fi
echo "  AGENT_PRIVATE_KEY ✓"

# Check PLATFORM_WALLET_ADDRESS
if [ -z "${PLATFORM_WALLET_ADDRESS:-}" ]; then
  warn "PLATFORM_WALLET_ADDRESS not set — payments will use placeholder address"
fi

# Check KeeperHub mode
if [ "${KEEPERHUB_MODE:-keeperhub}" = "direct" ]; then
  warn "KEEPERHUB_MODE=direct — bypassing KeeperHub, sending directly on-chain"
elif [ -z "${KEEPERHUB_API_KEY:-}" ]; then
  warn "KEEPERHUB_API_KEY not set — automatically falling back to direct mode"
  export KEEPERHUB_MODE=direct
else
  echo "  KeeperHub API key ✓"
fi

# Check dashboard is running
DASHBOARD_URL="${BASE_URL:-http://localhost:3001}"
step "Checking ScraperKast dashboard is running at ${DASHBOARD_URL}…"
if curl -sf "${DASHBOARD_URL}/api/test-content-eth" -o /dev/null --max-time 3 2>/dev/null; then
  success "Dashboard reachable"
elif curl -sf "${DASHBOARD_URL}/api/test-content-eth" \
         -o /dev/null \
         --max-time 3 \
         -w "%{http_code}" 2>/dev/null | grep -q "402"; then
  success "Dashboard reachable (correctly returning 402)"
else
  warn "Dashboard may not be running. Start it with:"
  echo "      cd ../../apps/dashboard && npm run dev"
  echo ""
  read -r -p "  Continue anyway? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# ── Install dependencies ──────────────────────────────────────────────────────

if [ ! -d node_modules ]; then
  step "Installing dependencies…"
  npm install --silent
  success "Dependencies installed"
else
  echo ""
  step "Dependencies already installed ✓"
fi

# ── Run agent ─────────────────────────────────────────────────────────────────

echo ""
header "STARTING AUTONOMOUS AGENT"
echo -e "  Watch the agent:"
echo -e "    • Receive a 402 Payment Required challenge"
echo -e "    • Run its decision engine (relevance + affordability)"
echo -e "    • Route payment through KeeperHub on Ethereum Sepolia"
echo -e "    • Retrieve a JWT and access gated content"
echo ""
echo -e "  ${CYAN}─────────────────────────────────────────────────────────${RESET}"
echo ""

npm start

echo ""
echo -e "  ${CYAN}─────────────────────────────────────────────────────────${RESET}"
echo ""
success "Demo complete!"
echo ""
echo -e "  ${BOLD}Links:${RESET}"
echo -e "    Sepolia Explorer: https://sepolia.etherscan.io"
echo -e "    KeeperHub:        https://app.keeperhub.ai"
echo -e "    ScraperKast docs: https://github.com/chiragravishankar/scraperkast"
echo ""
