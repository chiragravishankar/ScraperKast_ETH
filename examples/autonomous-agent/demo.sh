#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  ScraperKast — Autonomous Agent Demo Script
#  Runs the full end-to-end payment demo and captures output to demo.log
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DASHBOARD_DIR="$REPO_ROOT/apps/dashboard"
AGENT_DIR="$SCRIPT_DIR"
LOG_FILE="$AGENT_DIR/demo.log"
PORT=3000

# ── Colours ──────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

banner() {
  echo ""
  echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  🤖  ScraperKast Autonomous Agent — Demo Runner${NC}"
  echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
  echo ""
}

info()    { echo -e "${CYAN}[DEMO]${NC} $*"; }
success() { echo -e "${GREEN}[DEMO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[DEMO]${NC} $*"; }
error()   { echo -e "${RED}[DEMO]${NC} $*"; }

# ── Check prerequisites ───────────────────────────────────────────────────────
check_prereqs() {
  info "Checking prerequisites…"

  if ! command -v node &>/dev/null; then
    error "Node.js not found. Install Node 18+: https://nodejs.org"
    exit 1
  fi

  NODE_VER=$(node -e "console.log(process.version.slice(1).split('.')[0])")
  if [ "$NODE_VER" -lt 18 ]; then
    error "Node.js 18+ required (found v$NODE_VER)"
    exit 1
  fi

  if [ ! -f "$AGENT_DIR/.env" ]; then
    warn ".env not found. Running setup first…"
    cd "$AGENT_DIR"
    npm install --silent
    npm run setup
  fi

  success "Prerequisites OK (Node v$(node --version))"
}

# ── Ensure dependencies installed ─────────────────────────────────────────────
install_deps() {
  info "Installing agent dependencies…"
  cd "$AGENT_DIR"
  npm install --silent
  success "Dependencies installed"
}

# ── Start dashboard if not running ────────────────────────────────────────────
start_dashboard() {
  if lsof -Pi ":$PORT" -sTCP:LISTEN -t &>/dev/null; then
    success "Dashboard already running on port $PORT"
    return 0
  fi

  info "Starting ScraperKast dashboard (port $PORT)…"
  cd "$DASHBOARD_DIR"
  npm run dev > "$AGENT_DIR/dashboard.log" 2>&1 &
  DASHBOARD_PID=$!
  echo $DASHBOARD_PID > "$AGENT_DIR/.dashboard.pid"

  info "Waiting for dashboard to be ready…"
  RETRIES=0
  until curl -s "http://localhost:$PORT/api/test-content" &>/dev/null; do
    RETRIES=$((RETRIES+1))
    if [ $RETRIES -ge 30 ]; then
      error "Dashboard did not start after 60s. Check dashboard.log"
      exit 1
    fi
    sleep 2
    printf "."
  done
  echo ""
  success "Dashboard ready on http://localhost:$PORT"
}

# ── Run agent ─────────────────────────────────────────────────────────────────
run_agent() {
  info "Launching autonomous agent…"
  echo ""
  echo -e "${CYAN}════════════════════════ AGENT OUTPUT ════════════════════════${NC}"
  echo ""

  cd "$AGENT_DIR"

  # Run and tee to log file simultaneously so we see live output AND capture it
  if npm start 2>&1 | tee "$LOG_FILE"; then
    echo ""
    echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
    echo ""
    success "Agent completed successfully! 🎉"
    success "Full output saved to: $LOG_FILE"
  else
    error "Agent exited with errors. Check $LOG_FILE"
    exit 1
  fi
}

# ── Cleanup ───────────────────────────────────────────────────────────────────
cleanup() {
  PID_FILE="$AGENT_DIR/.dashboard.pid"
  if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      warn "Stopping dashboard (pid $PID)…"
      kill "$PID" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
}
trap cleanup EXIT

# ── Main ──────────────────────────────────────────────────────────────────────
banner
check_prereqs
install_deps
start_dashboard
run_agent

echo ""
success "Demo complete! 🚀"
echo ""
info "To record a video of this demo:"
info "  1. Run: bash demo.sh"
info "  2. Use QuickTime (Mac) or OBS to capture your terminal"
info "  3. The full log is at: $LOG_FILE"
echo ""
