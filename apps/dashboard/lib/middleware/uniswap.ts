/**
 * lib/middleware/uniswap.ts
 *
 * On-chain verification for Uniswap swap payments.
 * Checks that a swap transaction delivered the expected USDC to the recipient.
 *
 * Uses viem (already in workspace) — NOT ethers.
 * Uses standalone decodeEventLog — NOT client.decodeEventLog (doesn't exist).
 */

import { createPublicClient, http, parseAbi, decodeEventLog, type Address } from 'viem';
import { baseSepolia, sepolia } from 'viem/chains';
import { getNetworkConfig } from '@/lib/config';

// ── ERC-20 Transfer ABI ───────────────────────────────────────────────────────

const ERC20_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

// ── Known Transfer topic (keccak256 of Transfer signature) ────────────────────
// Used for a quick log pre-filter without full ABI decoding.
const TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SwapVerifyResult {
  verified:     boolean;
  usdcReceived?: number;
  blockNumber?:  number;
  gasUsed?:      number;
  tokenIn?:      string;  // address of input token (if detected)
  amountIn?:     number;  // human-readable amount of input token (if detected)
  error?:        string;
}

// ── Chain helper ──────────────────────────────────────────────────────────────

function getChain(network: string) {
  if (network === 'base-sepolia') return baseSepolia;
  if (network === 'sepolia')      return sepolia;
  throw new Error(`Unsupported network: "${network}"`);
}

// ── Main function ─────────────────────────────────────────────────────────────

/**
 * Verifies that a Uniswap swap transaction delivered the expected USDC
 * amount to the recipient.
 *
 * Tolerates ±1% slippage (Uniswap V3 default slippage window).
 */
export async function verifyUniswapSwap({
  txHash,
  network,
  expectedUsdcAmount,
  expectedRecipient,
}: {
  txHash:              string;
  network:             string;
  expectedUsdcAmount:  number;
  expectedRecipient:   string;
}): Promise<SwapVerifyResult> {
  try {
    const networkCfg = getNetworkConfig(network);

    const client = createPublicClient({
      chain:     getChain(network),
      transport: http(networkCfg.rpc),
    });

    // ── Fetch receipt ─────────────────────────────────────────────────────────

    const receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (!receipt) {
      return { verified: false, error: 'Transaction not found' };
    }

    if (receipt.status !== 'success') {
      return { verified: false, error: 'Transaction reverted' };
    }

    const usdcAddress      = networkCfg.usdc.toLowerCase();
    const recipientLower   = expectedRecipient.toLowerCase();

    let usdcReceived = 0;
    let tokenInAddress: string | undefined;
    let tokenInAmountWei: bigint | undefined;

    // ── Scan all Transfer logs ────────────────────────────────────────────────

    for (const log of receipt.logs) {
      // Quick pre-filter: must be a Transfer event
      if (log.topics[0] !== TRANSFER_TOPIC) continue;

      try {
        const decoded = decodeEventLog({
          abi:    ERC20_ABI,
          data:   log.data,
          topics: log.topics,
        });

        if (decoded.eventName !== 'Transfer') continue;

        const { from, to, value } = decoded.args as {
          from: Address;
          to:   Address;
          value: bigint;
        };

        if (log.address.toLowerCase() === usdcAddress) {
          // USDC Transfer — check if it goes to our recipient
          if (to.toLowerCase() === recipientLower) {
            usdcReceived += Number(value) / 1_000_000; // 6 decimals
          }
        } else {
          // Non-USDC Transfer — this is the input token of the swap.
          // The 'from' of the first non-USDC transfer is the bot's wallet.
          // Capture the first one we see (most swaps are single-hop).
          if (!tokenInAddress) {
            tokenInAddress   = log.address;
            tokenInAmountWei = value;
            // We don't know decimals here without an RPC call; we'll note the raw wei.
          }
        }
      } catch {
        // Different event signature — skip
      }
    }

    if (usdcReceived === 0) {
      return {
        verified: false,
        error:    'No USDC Transfer to recipient found in transaction logs',
      };
    }

    // ── Amount check (1% slippage tolerance for swaps) ────────────────────────

    const diff      = Math.abs(usdcReceived - expectedUsdcAmount);
    const tolerance = expectedUsdcAmount * 0.01; // 1%

    if (diff > tolerance) {
      return {
        verified: false,
        error: `Amount mismatch: expected ${expectedUsdcAmount} USDC, received ${usdcReceived.toFixed(6)} USDC`,
      };
    }

    return {
      verified:     true,
      usdcReceived,
      blockNumber:  Number(receipt.blockNumber),
      gasUsed:      Number(receipt.gasUsed),
      tokenIn:      tokenInAddress,
      // amountIn in human units is unknown without decimals; caller can resolve if needed
      amountIn:     tokenInAmountWei ? Number(tokenInAmountWei) : undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verification failed';
    console.error('[verifyUniswapSwap]', err);
    return { verified: false, error: msg };
  }
}
