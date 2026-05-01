/**
 * POST /api/payment/quote
 *
 * Returns a Uniswap V3 "exact output" quote:
 *   "I want exactly {amountOut} USDC — how much {tokenIn} do I need?"
 *
 * Body:   { tokenIn: string, amountOut: number, network: string }
 * Returns: QuoteResult (see type below)
 *
 * Tries the real Uniswap routing API first; if it returns no route (common on
 * testnets with thin liquidity), falls back to a realistic simulated quote so
 * the ETHGlobal demo keeps working end-to-end.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getNetworkConfig } from '@/lib/config';
import { getTokenByAddress, getTokenDecimals } from '@/lib/tokens';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuoteResult {
  tokenIn:       string;   // input token address
  tokenInSymbol: string;   // e.g. "WETH"
  tokenOut:      string;   // USDC address
  amountIn:      number;   // human-readable amount of tokenIn required
  amountOut:     number;   // human-readable USDC amount (what was requested)
  amountInWei:   string;   // amountIn in base units (for tx calldata)
  amountOutWei:  string;   // amountOut in base units
  priceImpact:   number;   // percentage
  slippage:      number;   // percentage
  deadline:      number;   // unix timestamp
  route:         string;   // human-readable path  e.g. "WETH → USDC"
  source:        'uniswap-api' | 'simulated'; // flag so callers know
  network:       string;
  chainId:       number;
  uniswapRouter: string;
}

// ── Uniswap routing API ───────────────────────────────────────────────────────

const UNISWAP_ROUTING_API = 'https://api.uniswap.org/v2/quote';

async function fetchUniswapQuote(params: {
  tokenIn:    string;
  tokenOut:   string;
  amountOut:  number;
  chainId:    number;
  deadline:   number;
}): Promise<{ amountInWei: string; priceImpact: number } | null> {
  const { tokenIn, tokenOut, amountOut, chainId, deadline } = params;

  // USDC has 6 decimals — exact output in base units
  const amountOutWei = Math.floor(amountOut * 1_000_000).toString();

  try {
    const res = await fetch(UNISWAP_ROUTING_API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokenInChainId:  chainId,
        tokenIn,
        tokenOutChainId: chainId,
        tokenOut,
        amount:          amountOutWei,
        type:            'EXACT_OUTPUT',
        slippageTolerance: '0.5',
        deadline,
      }),
      signal: AbortSignal.timeout(5_000), // 5 s timeout
    });

    if (!res.ok) return null;

    const data = await res.json() as {
      quote?: { amountIn?: string; priceImpact?: string };
      amountIn?: string;
      priceImpact?: string;
    };

    const amountInWei = data.quote?.amountIn ?? data.amountIn ?? null;
    const priceImpact = parseFloat(data.quote?.priceImpact ?? data.priceImpact ?? '0');

    if (!amountInWei) return null;
    return { amountInWei, priceImpact };
  } catch {
    return null; // Timeout, network error, etc.
  }
}

// ── Testnet simulation fallback ───────────────────────────────────────────────
//
// Uniswap testnets often have no liquidity. We simulate realistic prices so
// the full x402 flow can be demonstrated end-to-end.
//
// Prices are approximate (2026-era). Update ETH_PRICE_USD if needed.

const ETH_PRICE_USD  = 3_200;   // ~ETH price in USD
const WETH_DECIMALS  = 18;
const USDC_DECIMALS  = 6;

function simulateQuote(params: {
  tokenInAddress:   string;
  tokenInDecimals:  number;
  tokenInSymbol:    string;
  amountOut:        number;  // USDC
}): { amountInWei: string; priceImpact: number } {
  const { tokenInDecimals, tokenInSymbol, amountOut } = params;

  // Approximate USD value of 1 unit of tokenIn
  const tokenPriceUsd: Record<string, number> = {
    WETH:  ETH_PRICE_USD,
    WBTC:  65_000,
    DAI:   1.0,
    USDT:  1.0,
  };

  const priceUsd = tokenPriceUsd[tokenInSymbol.toUpperCase()] ?? 1;
  const amountInHuman = amountOut / priceUsd; // e.g. 0.05 USDC / 3200 = 0.0000156 WETH

  const amountInWei = BigInt(
    Math.ceil(amountInHuman * 10 ** tokenInDecimals),
  ).toString();

  return { amountInWei, priceImpact: 0.05 }; // tiny simulated impact
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      tokenIn:   string;
      amountOut: number;
      network:   string;
    };

    const { tokenIn, amountOut, network } = body;

    // ── Validation ────────────────────────────────────────────────────────────
    if (!tokenIn || !amountOut || !network) {
      return NextResponse.json(
        { error: 'Missing required fields: tokenIn, amountOut, network' },
        { status: 400 },
      );
    }

    if (amountOut <= 0) {
      return NextResponse.json({ error: 'amountOut must be > 0' }, { status: 400 });
    }

    // ── Network config (dynamic — no hardcoded addresses) ─────────────────────
    const networkCfg = getNetworkConfig(network); // throws on unknown network
    const tokenOut   = networkCfg.usdc;
    const deadline   = Math.floor(Date.now() / 1000) + 60 * 20; // 20 minutes

    // ── Token metadata ────────────────────────────────────────────────────────
    const tokenInMeta    = getTokenByAddress(tokenIn, network);
    const tokenInSymbol  = tokenInMeta?.symbol ?? 'TOKEN';
    const tokenInDecimals = getTokenDecimals(tokenIn, network);
    const amountOutWei   = Math.floor(amountOut * 1_000_000).toString();

    // ── Get quote (real API → simulation fallback) ────────────────────────────
    let quoteData: { amountInWei: string; priceImpact: number } | null = null;
    let source: QuoteResult['source'] = 'uniswap-api';

    // Attempt 1: Uniswap routing API
    quoteData = await fetchUniswapQuote({
      tokenIn,
      tokenOut,
      amountOut,
      chainId: networkCfg.chainId,
      deadline,
    });

    // Attempt 2: Simulated quote (testnet / no liquidity)
    if (!quoteData) {
      source    = 'simulated';
      quoteData = simulateQuote({
        tokenInAddress:  tokenIn,
        tokenInDecimals,
        tokenInSymbol,
        amountOut,
      });
    }

    const amountIn = Number(quoteData.amountInWei) / (10 ** tokenInDecimals);

    const result: QuoteResult = {
      tokenIn,
      tokenInSymbol,
      tokenOut,
      amountIn:      parseFloat(amountIn.toFixed(tokenInDecimals > 6 ? 10 : 6)),
      amountOut,
      amountInWei:   quoteData.amountInWei,
      amountOutWei,
      priceImpact:   quoteData.priceImpact,
      slippage:      0.5,
      deadline,
      route:         `${tokenInSymbol} → USDC`,
      source,
      network,
      chainId:       networkCfg.chainId,
      uniswapRouter: networkCfg.uniswapRouter,
    };

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[POST /api/payment/quote]', err);
    return NextResponse.json({ error: 'Failed to get quote', details: msg }, { status: 500 });
  }
}
