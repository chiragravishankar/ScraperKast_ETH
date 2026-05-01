/**
 * KeeperHub execution layer client.
 *
 * KeeperHub is an Ethereum meta-transaction relay that executes on-chain payments
 * on behalf of agents, providing MEV protection, gas abstraction, and retry logic.
 *
 * Modes (controlled by KEEPERHUB_MODE env var):
 *   "keeperhub" — real KeeperHub API (requires KEEPERHUB_API_KEY)
 *   "direct"    — bypass KeeperHub; transact directly with ethers.js
 */
import axios, { type AxiosError } from 'axios';
import { ethers } from 'ethers';
import { log } from './logger.js';
import { transferUsdc, signPayment } from './wallet.js';

// ── Config ────────────────────────────────────────────────────────────────────

const KEEPERHUB_API_KEY = process.env.KEEPERHUB_API_KEY ?? '';
const KEEPERHUB_API_URL = process.env.KEEPERHUB_API_URL ?? 'https://api.keeperhub.ai/v1';
const KEEPERHUB_MODE    = (process.env.KEEPERHUB_MODE ?? 'keeperhub') as 'keeperhub' | 'direct';
const USDC_CONTRACT     = process.env.USDC_CONTRACT ?? '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

// ── Minimal ERC-20 interface for calldata encoding ────────────────────────────

const ERC20_IFACE = new ethers.Interface([
  'function transfer(address to, uint256 amount) returns (bool)',
]);

// ── Public types ──────────────────────────────────────────────────────────────

export interface ExecutionResult {
  executionId: string;
  txHash:      string;
  status:      'confirmed';
  elapsedMs:   number;
  mode:        'keeperhub' | 'direct';
}

// ── KeeperHub API shapes ──────────────────────────────────────────────────────

interface SubmitResponse {
  executionId:               string;
  status:                    string;
  estimatedConfirmationMs?:  number;
}

interface PollResponse {
  executionId: string;
  status:      'pending' | 'submitted' | 'confirming' | 'confirmed' | 'failed';
  txHash?:     string;
  blockNumber?: number;
  gasUsed?:    string;
  error?:      string;
}

// ── Client ────────────────────────────────────────────────────────────────────

export class KeeperHubClient {
  private readonly headers = {
    'Authorization': `Bearer ${KEEPERHUB_API_KEY}`,
    'Content-Type':  'application/json',
    'X-Client':      'ScraperKast-Agent/1.0',
    'X-Hackathon':   'ETHGlobal-2026',
  };

  get mode(): 'keeperhub' | 'direct' {
    return KEEPERHUB_MODE;
  }

  /**
   * Execute a USDC micropayment through KeeperHub (or directly on-chain).
   * Returns a confirmed tx hash and KeeperHub execution ID.
   */
  async executePayment(
    wallet:      ethers.Wallet,
    recipient:   string,
    amount:      bigint,        // µUSDC with 6 decimals
    usdcAddress = USDC_CONTRACT
  ): Promise<ExecutionResult> {
    if (KEEPERHUB_MODE === 'direct') {
      return this.executeDirectly(wallet, recipient, amount, usdcAddress);
    }
    return this.executeViaKeeperHub(wallet, recipient, amount, usdcAddress);
  }

  // ── KeeperHub path ──────────────────────────────────────────────────────────

  private async executeViaKeeperHub(
    wallet:      ethers.Wallet,
    recipient:   string,
    amount:      bigint,
    usdcAddress: string
  ): Promise<ExecutionResult> {
    const start = Date.now();

    // Encode ERC-20 transfer calldata
    const calldata = ERC20_IFACE.encodeFunctionData('transfer', [recipient, amount]);

    // Agent signs the payment to authorise KeeperHub
    log.keeper('Signing payment authorisation for KeeperHub…');
    const signature = await signPayment(wallet, usdcAddress, recipient, amount);

    log.keeper('Submitting execution request to KeeperHub API…');
    log.detail('Endpoint:', `${KEEPERHUB_API_URL}/executions`);
    log.detail('Mode:',     'KeeperHub relay');
    log.detail('Network:',  'Ethereum Sepolia');

    let executionId: string;
    try {
      const res = await axios.post<SubmitResponse>(
        `${KEEPERHUB_API_URL}/executions`,
        {
          type:      'erc20_transfer',
          network:   'sepolia',
          from:      wallet.address,
          to:        usdcAddress,   // USDC contract
          calldata,
          signature,                // proves agent authorised this spend
          metadata: {
            project:    'ScraperKast',
            hackathon:  'ETHGlobal',
            recipient,
            amount:     amount.toString(),
            protocol:   'x402',
          },
        },
        { headers: this.headers }
      );
      executionId = res.data.executionId;
    } catch (err) {
      const msg = (err as AxiosError<{ error?: string }>).response?.data?.error
        ?? String(err);
      throw new Error(`KeeperHub submit failed: ${msg}`);
    }

    log.keeper(`Execution submitted → ID: ${executionId}`);

    // Poll until confirmed
    const txHash = await this.pollExecution(executionId);
    const elapsedMs = Date.now() - start;

    return { executionId, txHash, status: 'confirmed', elapsedMs, mode: 'keeperhub' };
  }

  private async pollExecution(
    executionId: string,
    maxWaitMs = 90_000
  ): Promise<string> {
    const deadline = Date.now() + maxWaitMs;
    let attempt = 0;

    while (Date.now() < deadline) {
      attempt++;
      // Exponential backoff: 2s, 3s, 4s, 5s… cap at 8s
      const delayMs = Math.min(2000 + attempt * 1000, 8000);
      await new Promise(r => setTimeout(r, delayMs));

      let data: PollResponse;
      try {
        const res = await axios.get<PollResponse>(
          `${KEEPERHUB_API_URL}/executions/${executionId}`,
          { headers: this.headers }
        );
        data = res.data;
      } catch (err) {
        log.keeper(`Poll #${attempt}: network error — ${String(err)}`);
        continue;
      }

      const { status, txHash, error } = data;
      const preview = txHash ? ` tx=${txHash.slice(0, 14)}…` : '';
      log.keeper(`Poll #${attempt}: status=${status}${preview}`);

      if (status === 'confirmed' && txHash) return txHash;
      if (status === 'failed') {
        throw new Error(`KeeperHub execution failed: ${error ?? 'unknown reason'}`);
      }
    }

    throw new Error(`KeeperHub execution timed out after ${maxWaitMs / 1000}s`);
  }

  // ── Direct fallback path ────────────────────────────────────────────────────

  private async executeDirectly(
    wallet:      ethers.Wallet,
    recipient:   string,
    amount:      bigint,
    usdcAddress: string
  ): Promise<ExecutionResult> {
    const start = Date.now();
    log.keeper('Direct mode — sending USDC transfer via ethers.js (no KeeperHub)…');

    const txHash    = await transferUsdc(wallet, recipient, amount, usdcAddress);
    const elapsedMs = Date.now() - start;

    // Synthetic execution ID for direct mode
    const executionId = `direct-${txHash.slice(2, 18)}`;

    return { executionId, txHash, status: 'confirmed', elapsedMs, mode: 'direct' };
  }
}
