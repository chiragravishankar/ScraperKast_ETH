import {
  Transaction,
  PublicKey,
  type Keypair,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getAccount,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import type { SolanaConnection } from './connection.js';
import { NETWORKS } from './config.js';
import { getCurrentNetwork, getExplorerUrl } from './index.js';
import type {
  CreatePaymentParams,
  PaymentVerification,
  PaymentStatus,
} from './types.js';

// PublicKey is both a runtime class (new PublicKey(...)) and a type used in
// CreatePaymentParams. The single non-type import above covers both roles.

// ── Constants ─────────────────────────────────────────────────────────────────

/** USDC uses 6 decimal places. 1 USDC = 1_000_000 micro-USDC. */
export const USDC_DECIMALS = 6;

// ── Internal helpers ──────────────────────────────────────────────────────────

/** Minimal shape of a token balance entry we care about in verify. */
interface RawTokenBalance {
  mint: string;
  owner?: string;
  uiTokenAmount: { amount: string; decimals: number };
}

/**
 * Computes net micro-USDC changes per owner address for a specific mint.
 * Returns a Map<ownerAddress, deltaAmount> where positive = received.
 */
function computeBalanceChanges(
  pre: RawTokenBalance[],
  post: RawTokenBalance[],
  mint: string,
): Map<string, number> {
  const preByOwner = new Map<string, number>();
  for (const b of pre) {
    if (b.mint === mint && b.owner) {
      preByOwner.set(b.owner, parseInt(b.uiTokenAmount.amount, 10));
    }
  }

  const changes = new Map<string, number>();
  for (const b of post) {
    if (b.mint === mint && b.owner) {
      const before = preByOwner.get(b.owner) ?? 0;
      const after = parseInt(b.uiTokenAmount.amount, 10);
      changes.set(b.owner, after - before);
    }
  }

  return changes;
}

// ── SolanaPaymentService ──────────────────────────────────────────────────────

export class SolanaPaymentService {
  private readonly solanaConn: SolanaConnection;
  private readonly platformWallet: PublicKey;

  constructor(connection: SolanaConnection, platformWallet: PublicKey) {
    this.solanaConn = connection;
    this.platformWallet = platformWallet;
  }

  // ── createPayment ───────────────────────────────────────────────────────────

  /**
   * Builds an unsigned USDC transaction that splits payment between the
   * website owner (basePrice) and the platform (scraperKastFee).
   *
   * If either recipient doesn't have a USDC token account yet, an
   * associated-token-account creation instruction is prepended automatically.
   *
   * @throws If the bot's USDC balance is insufficient.
   */
  async createPayment(params: CreatePaymentParams): Promise<Transaction> {
    const { botWallet, ownerWallet, platformWallet, basePrice, scraperKastFee, botId, domain } = params;
    const network = this.solanaConn.getNetwork();
    const networkCfg = NETWORKS[network];
    const usdcMint = new PublicKey(networkCfg.usdcMint);
    const connection = this.solanaConn.getConnection();

    // Derive associated token accounts (deterministic, no RPC call).
    const botAta      = await getAssociatedTokenAddress(usdcMint, botWallet);
    const ownerAta    = await getAssociatedTokenAddress(usdcMint, ownerWallet);
    const platformAta = await getAssociatedTokenAddress(usdcMint, platformWallet);

    const tx = new Transaction();

    // Ensure owner ATA exists; create it if not (funded by bot as fee payer).
    try {
      await getAccount(connection, ownerAta);
    } catch (e) {
      if (e instanceof TokenAccountNotFoundError) {
        tx.add(createAssociatedTokenAccountInstruction(
          botWallet, ownerAta, ownerWallet, usdcMint,
        ));
        console.log(`[Payment] Creating owner ATA for ${ownerWallet.toBase58()}`);
      } else {
        throw e;
      }
    }

    // Ensure platform ATA exists; create it if not.
    try {
      await getAccount(connection, platformAta);
    } catch (e) {
      if (e instanceof TokenAccountNotFoundError) {
        tx.add(createAssociatedTokenAccountInstruction(
          botWallet, platformAta, platformWallet, usdcMint,
        ));
        console.log(`[Payment] Creating platform ATA for ${platformWallet.toBase58()}`);
      } else {
        throw e;
      }
    }

    // Verify bot has sufficient USDC.
    const botAccount = await getAccount(connection, botAta);
    const totalRequired = BigInt(basePrice + scraperKastFee);
    if (botAccount.amount < totalRequired) {
      throw new Error(
        `Insufficient USDC balance for bot ${botId} on ${domain}. ` +
        `Required: ${totalRequired} µUSDC, available: ${botAccount.amount} µUSDC.`,
      );
    }

    // Instruction 1: transfer basePrice → website owner.
    if (basePrice > 0) {
      tx.add(createTransferCheckedInstruction(
        botAta, usdcMint, ownerAta, botWallet,
        BigInt(basePrice), USDC_DECIMALS,
      ));
    }

    // Instruction 2: transfer scraperKastFee → platform.
    if (scraperKastFee > 0) {
      tx.add(createTransferCheckedInstruction(
        botAta, usdcMint, platformAta, botWallet,
        BigInt(scraperKastFee), USDC_DECIMALS,
      ));
    }

    // Set fee payer; blockhash is added in executePayment (has TTL).
    tx.feePayer = botWallet;

    const total = basePrice + scraperKastFee;
    console.log(
      `[Payment] Created tx for ${botId}@${domain}: ` +
      `${basePrice} µUSDC → owner, ${scraperKastFee} µUSDC → platform ` +
      `(total ${total} µUSDC = ${(total / 1_000_000).toFixed(6)} USDC)`,
    );

    return tx;
  }

  // ── executePayment ──────────────────────────────────────────────────────────

  /**
   * Adds a fresh blockhash, signs with the bot keypair, sends, and waits for
   * confirmation. Returns the transaction signature.
   *
   * **For testing only.** In production the bot signs its own transaction.
   */
  async executePayment(transaction: Transaction, botKeypair: Keypair): Promise<string> {
    const connection = this.solanaConn.getConnection();
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = botKeypair.publicKey;

    transaction.sign(botKeypair);
    const rawTx    = transaction.serialize();
    const signature = await connection.sendRawTransaction(rawTx);
    await this.solanaConn.confirmTransaction(signature);

    const explorerUrl = this.explorerTxUrl(signature);
    console.log(`[Payment] Executed. Signature: ${signature}`);
    console.log(`[Payment] Explorer: ${explorerUrl}`);

    return signature;
  }

  // ── verifyPayment ───────────────────────────────────────────────────────────

  /**
   * Fetches the on-chain transaction, verifies the USDC mint, and computes
   * how much each party received.
   */
  async verifyPayment(txSignature: string): Promise<PaymentVerification> {
    const network = this.solanaConn.getNetwork();
    const networkCfg = NETWORKS[network];
    const explorerUrl = this.explorerTxUrl(txSignature);

    const tx = await this.solanaConn.getTransaction(txSignature);

    if (!tx || !tx.meta) {
      return {
        isValid: false,
        txSignature,
        expectedAmount: 0,
        actualAmount: 0,
        ownerReceived: 0,
        platformReceived: 0,
        status: 'failed',
        explorerUrl,
      };
    }

    const status: PaymentStatus = tx.meta.err ? 'failed' : 'confirmed';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const meta = tx.meta as any;
    const pre: RawTokenBalance[]  = meta.preTokenBalances  ?? [];
    const post: RawTokenBalance[] = meta.postTokenBalances ?? [];

    const changes = computeBalanceChanges(pre, post, networkCfg.usdcMint);

    // Identify platform's received amount; everything else positive is the owner.
    const platformKey = this.platformWallet.toBase58();
    const platformReceived = Math.max(0, changes.get(platformKey) ?? 0);

    let ownerReceived = 0;
    for (const [owner, delta] of changes) {
      if (owner !== platformKey && delta > 0) {
        ownerReceived += delta;
      }
    }

    const actualAmount = ownerReceived + platformReceived;
    const isValid = status === 'confirmed' && actualAmount > 0;

    console.log(
      `[Payment] Verify ${txSignature}: ` +
      `owner=${ownerReceived} µUSDC, platform=${platformReceived} µUSDC, ` +
      `valid=${isValid}. ${explorerUrl}`,
    );

    return {
      isValid,
      txSignature,
      expectedAmount: actualAmount,
      actualAmount,
      ownerReceived,
      platformReceived,
      status,
      explorerUrl,
    };
  }

  // ── getPaymentStatus ────────────────────────────────────────────────────────

  /** Checks the confirmation status of a transaction signature. */
  async getPaymentStatus(txSignature: string): Promise<PaymentStatus> {
    try {
      const confirmed = await this.solanaConn.confirmTransaction(txSignature);
      return confirmed ? 'confirmed' : 'failed';
    } catch {
      return 'failed';
    }
  }

  // ── createTokenAccountIfNeeded ──────────────────────────────────────────────

  /**
   * Derives the associated USDC token account for `owner`.
   * Checks whether the account exists on-chain. If not, callers should include
   * a `createAssociatedTokenAccountInstruction` in their transaction.
   *
   * Returns the ATA's public key regardless of whether it currently exists.
   */
  async createTokenAccountIfNeeded(owner: PublicKey): Promise<PublicKey> {
    const network = this.solanaConn.getNetwork();
    const usdcMint  = new PublicKey(NETWORKS[network].usdcMint);
    const connection = this.solanaConn.getConnection();

    const ata = await getAssociatedTokenAddress(usdcMint, owner);

    try {
      await getAccount(connection, ata);
      console.log(`[Payment] ATA exists for ${owner.toBase58()}: ${ata.toBase58()}`);
    } catch (e) {
      if (e instanceof TokenAccountNotFoundError) {
        console.log(`[Payment] ATA not found for ${owner.toBase58()} — will be created in next payment tx.`);
      } else {
        throw e;
      }
    }

    return ata;
  }

  // ── private helpers ─────────────────────────────────────────────────────────

  private explorerTxUrl(signature: string): string {
    const base = NETWORKS[this.solanaConn.getNetwork()].explorerUrl;
    return `${base}/tx/${signature}`;
  }
}
