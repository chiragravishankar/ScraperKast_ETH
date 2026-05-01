import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} from '@solana/spl-token';
import { log } from './logger.js';

// ── Keypair helpers ───────────────────────────────────────────────────────────

export function loadKeypair(): Keypair {
  const raw = process.env.AGENT_PRIVATE_KEY;
  if (!raw) {
    throw new Error(
      'AGENT_PRIVATE_KEY is not set. Run `npm run setup` first.'
    );
  }
  const secretKey = Uint8Array.from(JSON.parse(raw) as number[]);
  return Keypair.fromSecretKey(secretKey);
}

export function keypairToEnvString(kp: Keypair): string {
  return JSON.stringify(Array.from(kp.secretKey));
}

// ── Balance ───────────────────────────────────────────────────────────────────

export async function getSolBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  const lamports = await connection.getBalance(publicKey);
  return lamports / LAMPORTS_PER_SOL;
}

/**
 * Returns the token balance in micro-units (raw amount with 6 decimal places).
 * Returns 0 if the associated token account doesn't exist yet.
 */
export async function getTokenBalance(
  connection: Connection,
  walletPublicKey: PublicKey,
  mint: PublicKey
): Promise<number> {
  try {
    const ata = await getAssociatedTokenAddress(mint, walletPublicKey);
    const info = await connection.getTokenAccountBalance(ata);
    return Number(info.value.amount);
  } catch {
    return 0; // Token account not created yet
  }
}

// ── Transfer ──────────────────────────────────────────────────────────────────

/**
 * Transfer `amount` µ-token from payer to `recipient`.
 * Automatically creates the recipient's ATA if it doesn't exist.
 *
 * Returns the confirmed transaction signature.
 */
export async function transferTokens(
  connection: Connection,
  payer: Keypair,
  recipient: PublicKey,
  mint: PublicKey,
  amount: number // in micro-units (6 decimals)
): Promise<string> {
  log.chain('Creating/fetching sender token account…');
  const fromATA = await getOrCreateAssociatedTokenAccount(
    connection, payer, mint, payer.publicKey
  );

  log.chain('Creating/fetching recipient token account…');
  const toATA = await getOrCreateAssociatedTokenAccount(
    connection, payer, mint, recipient
  );

  const instruction = createTransferInstruction(
    fromATA.address,
    toATA.address,
    payer.publicKey,
    BigInt(amount)
  );

  const tx = new Transaction().add(instruction);
  const sig = await sendAndConfirmTransaction(
    connection,
    tx,
    [payer],
    { commitment: 'confirmed', preflightCommitment: 'confirmed' }
  );

  return sig;
}

// ── Airdrop ───────────────────────────────────────────────────────────────────

export async function requestAirdrop(
  connection: Connection,
  publicKey: PublicKey,
  solAmount = 2
): Promise<void> {
  log.chain(`Requesting ${solAmount} SOL airdrop from devnet faucet…`);
  const sig = await connection.requestAirdrop(
    publicKey,
    solAmount * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(sig, 'confirmed');
  log.success(`Airdrop confirmed. Wallet funded with ${solAmount} SOL.`);
}
