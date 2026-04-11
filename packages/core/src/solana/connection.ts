import {
  Connection,
  PublicKey,
  type TransactionResponse,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { NETWORKS } from './config.js';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
  // unreachable, but satisfies TypeScript
  throw new Error('Retry limit exceeded');
}

export class SolanaConnection {
  private readonly _network: 'devnet' | 'mainnet';
  private readonly _connection: Connection;

  constructor(network?: 'devnet' | 'mainnet') {
    const raw = (process.env['SOLANA_NETWORK'] ?? 'devnet').toLowerCase();
    this._network = network ?? (raw === 'mainnet' ? 'mainnet' : 'devnet');

    const rpcUrl =
      process.env['SOLANA_RPC_URL'] ?? NETWORKS[this._network].rpcUrl;

    this._connection = new Connection(rpcUrl, 'confirmed');

    console.log(`[SolanaConnection] Connected to ${this._network} (${rpcUrl})`);
  }

  /** Returns the underlying web3.js Connection. */
  getConnection(): Connection {
    return this._connection;
  }

  /** Returns the active network name. */
  getNetwork(): 'devnet' | 'mainnet' {
    return this._network;
  }

  /** Returns the current block height. */
  async getBlockHeight(): Promise<number> {
    return withRetry(() => this._connection.getBlockHeight());
  }

  /**
   * Returns the SOL balance of a public key in lamports.
   * Divide by LAMPORTS_PER_SOL (1_000_000_000) to get SOL.
   */
  async getBalance(publicKey: PublicKey): Promise<number> {
    return withRetry(() => this._connection.getBalance(publicKey));
  }

  /**
   * Waits for a transaction signature to reach 'confirmed' commitment.
   * Returns true if confirmed, false if not found within timeout.
   */
  async confirmTransaction(signature: string): Promise<boolean> {
    try {
      const result = await withRetry(() =>
        this._connection.confirmTransaction(signature, 'confirmed'),
      );
      return result.value.err === null;
    } catch {
      return false;
    }
  }

  /** Fetches a transaction by signature. Returns null if not found. */
  async getTransaction(signature: string): Promise<TransactionResponse | null> {
    return withRetry(() =>
      this._connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      }),
    ) as Promise<TransactionResponse | null>;
  }

  /**
   * Requests an airdrop of SOL on devnet.
   * @throws Error if called on mainnet.
   */
  async requestAirdrop(publicKey: PublicKey, lamports: number): Promise<string> {
    if (this._network === 'mainnet') {
      throw new Error(
        'Airdrop is not available on mainnet. Use devnet for testing.',
      );
    }
    const maxAirdrop = 2 * LAMPORTS_PER_SOL;
    if (lamports > maxAirdrop) {
      throw new Error(
        `Airdrop limited to ${maxAirdrop} lamports (2 SOL) on devnet.`,
      );
    }
    return withRetry(() => this._connection.requestAirdrop(publicKey, lamports));
  }
}
