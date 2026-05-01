/**
 * Idempotent setup for the autonomous agent.
 * Safe to run multiple times — resumes from wherever it left off.
 *
 * What this does:
 *  1. Loads existing keypairs from .env (if present), otherwise generates new ones
 *  2. Airdrops SOL only if the wallet balance is below 1.5 SOL
 *  3. Reuses the existing SPL token mint (if USDC_MINT is in .env and on-chain)
 *  4. Mints test-USDC only if the agent wallet balance is below 1 USDC
 *  5. Writes (or updates) .env with all resolved values
 *
 * Run: npm run setup
 */

import * as dotenv from 'dotenv';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from '@solana/web3.js';
import {
  createMint,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { log } from './logger.js';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH   = path.join(__dirname, '..', '.env');
const SOLANA_RPC = 'https://api.devnet.solana.com';

// ── Load .env BEFORE doing anything so process.env is populated ───────────────
const envExists = fs.existsSync(ENV_PATH);
if (envExists) {
  dotenv.config({ path: ENV_PATH });
  // don't log yet — banner comes first
} else {
  dotenv.config(); // fall back to cwd .env if somehow different
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function kpToJson(kp: Keypair): string {
  return JSON.stringify(Array.from(kp.secretKey));
}

/**
 * If the env var holds a valid JSON byte-array, reconstruct the keypair.
 * Otherwise generate a brand-new one.
 */
function loadOrGenerate(envKey: string, label: string): { kp: Keypair; isNew: boolean } {
  const raw = process.env[envKey];
  if (raw) {
    try {
      const bytes = Uint8Array.from(JSON.parse(raw) as number[]);
      const kp = Keypair.fromSecretKey(bytes);
      log.info(`${label}: loaded existing keypair ${kp.publicKey.toBase58()}`);
      return { kp, isNew: false };
    } catch {
      log.info(`${label}: ${envKey} present but unreadable — generating fresh keypair`);
    }
  }
  const kp = Keypair.generate();
  log.success(`${label}: generated new keypair ${kp.publicKey.toBase58()}`);
  return { kp, isNew: true };
}

// ── Step: conditional airdrop ─────────────────────────────────────────────────

/**
 * Attempts an airdrop if the wallet has < 1 SOL.
 * Returns true if the wallet is funded (>= 1 SOL) after the attempt.
 * Never throws — airdrop failure is non-fatal.
 */
async function airdropIfNeeded(
  connection: Connection,
  pk: PublicKey,
  label: string
): Promise<boolean> {
  const lamports = await connection.getBalance(pk);
  const sol      = lamports / LAMPORTS_PER_SOL;

  if (sol >= 1) {
    log.info(`${label} already funded with ${sol.toFixed(4)} SOL — skipping airdrop ✓`);
    return true;
  }

  log.chain(`${label} has ${sol.toFixed(4)} SOL (need ≥ 1). Requesting 2 SOL airdrop…`);
  try {
    const sig = await connection.requestAirdrop(pk, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, 'confirmed');
    const newBal = (await connection.getBalance(pk)) / LAMPORTS_PER_SOL;
    log.success(`${label} airdrop confirmed — new balance: ${newBal.toFixed(4)} SOL`);
    return true;
  } catch (err) {
    log.error(`Airdrop failed for ${label}: ${String(err)}`);
    return false;
  }
}

// ── Step: get-or-create mint ──────────────────────────────────────────────────

async function getOrCreateMint(
  connection: Connection,
  payer: Keypair
): Promise<{ mint: PublicKey; isNew: boolean }> {
  const existingStr = process.env.USDC_MINT;

  if (existingStr) {
    try {
      const existingPk = new PublicKey(existingStr);
      // Verify it actually exists on-chain
      await getMint(connection, existingPk);
      log.info(`Reusing existing test-USDC mint: ${existingStr} ✓`);
      return { mint: existingPk, isNew: false };
    } catch {
      log.info(
        `USDC_MINT=${existingStr} not found on devnet — creating a new mint`
      );
    }
  }

  log.chain('Creating new SPL token mint (6 decimals, agent = mint authority)…');
  const mint = await createMint(
    connection,
    payer,           // fee payer
    payer.publicKey, // mint authority
    null,            // freeze authority (disabled)
    6                // same decimals as real USDC
  );
  log.success(`Test-USDC mint created: ${mint.toBase58()}`);
  return { mint, isNew: true };
}

// ── Step: conditional mint ────────────────────────────────────────────────────

async function mintIfNeeded(
  connection: Connection,
  payer: Keypair,
  mint: PublicKey,
  recipient: PublicKey
): Promise<void> {
  const MIN_BALANCE  = 1_000_000; // 1 µ-USDC = 1 test-USDC
  const MINT_AMOUNT  = 10_000_000; // 10 test-USDC

  // Check existing balance
  let existing = 0;
  try {
    const ata  = await getAssociatedTokenAddress(mint, recipient);
    const info = await connection.getTokenAccountBalance(ata);
    existing   = Number(info.value.amount);
  } catch {
    existing = 0; // token account not created yet
  }

  if (existing >= MIN_BALANCE) {
    log.info(
      `Agent already has ${existing.toLocaleString()} µUSDC` +
      ` (${(existing / 1_000_000).toFixed(2)} test-USDC) — skipping mint ✓`
    );
    return;
  }

  log.chain(
    `Agent has ${existing.toLocaleString()} µUSDC. Minting ${MINT_AMOUNT.toLocaleString()} µUSDC…`
  );
  const ata = await getOrCreateAssociatedTokenAccount(
    connection, payer, mint, recipient
  );
  await mintTo(connection, payer, mint, ata.address, payer, MINT_AMOUNT);
  log.success(
    `Minted ${MINT_AMOUNT.toLocaleString()} µUSDC` +
    ` (${MINT_AMOUNT / 1_000_000} test-USDC) to agent wallet`
  );
}

// ── .env writer ───────────────────────────────────────────────────────────────

function writeEnv(agentKp: Keypair, platformKp: Keypair, mintAddress?: string): void {
  const lines = [
    '# ── Generated/updated by npm run setup ───────────────────────────────────────',
    `AGENT_PRIVATE_KEY='${kpToJson(agentKp)}'`,
    `AGENT_WALLET_ADDRESS=${agentKp.publicKey.toBase58()}`,
    `PLATFORM_PRIVATE_KEY='${kpToJson(platformKp)}'`,
    `PLATFORM_WALLET_ADDRESS=${platformKp.publicKey.toBase58()}`,
  ];

  if (mintAddress) {
    lines.push(`USDC_MINT=${mintAddress}`);
  } else {
    lines.push('# USDC_MINT=  ← set after re-running setup with funded wallets');
  }

  lines.push(
    '',
    '# ── Network ───────────────────────────────────────────────────────────────────',
    'SOLANA_NETWORK=devnet',
    `SOLANA_RPC=${SOLANA_RPC}`,
    '',
    '# ── Target endpoints ──────────────────────────────────────────────────────────',
    'BASE_URL=http://localhost:3000',
    'TARGET_ENDPOINT=http://localhost:3000/api/test-content',
    'VERIFY_ENDPOINT=http://localhost:3000/api/test-content/verify',
    '',
    '# ── Agent configuration ───────────────────────────────────────────────────────',
    'AGENT_GOAL=Find and access content about AI trends',
    'MAX_PRICE_USDC=10000',
  );

  fs.writeFileSync(ENV_PATH, lines.join('\n'), 'utf-8');
  log.success(`.env saved → ${ENV_PATH}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function setup() {
  log.banner();

  if (envExists) {
    log.section('SETUP — RESUMING (existing .env found)');
    log.info('Wallets and mint will be reused. Only missing resources will be created.');
  } else {
    log.section('SETUP — FIRST RUN (no .env found)');
    log.info('Generating new wallets and test-USDC mint.');
  }

  const connection = new Connection(SOLANA_RPC, 'confirmed');

  // ── 1. Keypairs ──────────────────────────────────────────────────────────────
  log.section('1/5  Wallets');
  const { kp: agentKp }    = loadOrGenerate('AGENT_PRIVATE_KEY',    'Agent   ');
  const { kp: platformKp } = loadOrGenerate('PLATFORM_PRIVATE_KEY', 'Platform');

  // ── 2. Airdrop (non-fatal, balance-gated) ────────────────────────────────────
  log.section('2/5  SOL Balances');
  const agentFunded    = await airdropIfNeeded(connection, agentKp.publicKey,    'Agent   ');
  const platformFunded = await airdropIfNeeded(connection, platformKp.publicKey, 'Platform');

  // ── 3. Check SOL — save .env and give clear instructions if under-funded ─────
  if (!agentFunded || !platformFunded) {
    log.section('Writing .env (wallets only — re-run after funding)');
    writeEnv(agentKp, platformKp); // no mint yet

    console.log('');
    console.log('⚠️  Airdrop failed. Please fund these wallets manually:');
    if (!agentFunded)    console.log(`   Agent:    ${agentKp.publicKey.toBase58()} — needs 2 SOL`);
    if (!platformFunded) console.log(`   Platform: ${platformKp.publicKey.toBase58()} — needs 2 SOL`);
    console.log('');
    console.log('   Fund at: https://faucet.solana.com');
    console.log('   Then rerun: npm run setup');
    console.log('');
    return; // clean exit — .env is already saved with addresses
  }

  // ── 4–5. Token operations — always save .env even if these fail ──────────────
  let mintAddress: string | undefined;
  try {
    // 4. Mint
    log.section('3/5  Test-USDC Mint');
    const { mint } = await getOrCreateMint(connection, agentKp);
    mintAddress = mint.toBase58();

    // 5. Fund agent with test USDC
    log.section('4/5  Agent Test-USDC Balance');
    await mintIfNeeded(connection, agentKp, mint, agentKp.publicKey);

    // 6. Pre-create platform ATA
    log.section('5/5  Platform Token Account');
    await getOrCreateAssociatedTokenAccount(connection, agentKp, mint, platformKp.publicKey);
    log.success('Platform token account ready ✓');

  } finally {
    // Always write .env — even if a token step threw
    log.section('Writing .env');
    writeEnv(agentKp, platformKp, mintAddress);
  }

  // ── Summary (only reached if token ops succeeded) ────────────────────────────
  const agentSol  = (await connection.getBalance(agentKp.publicKey)) / LAMPORTS_PER_SOL;
  let   agentUsdc = 0;
  try {
    const ata  = await getAssociatedTokenAddress(new PublicKey(mintAddress!), agentKp.publicKey);
    const info = await connection.getTokenAccountBalance(ata);
    agentUsdc  = Number(info.value.amount);
  } catch { /* 0 */ }

  log.section('SETUP COMPLETE');
  log.detail('Agent wallet:',    agentKp.publicKey.toBase58());
  log.detail('Platform wallet:', platformKp.publicKey.toBase58());
  log.detail('USDC mint:',       mintAddress ?? '—');
  log.detail('Agent SOL:',       `${agentSol.toFixed(4)} SOL`);
  log.detail('Agent USDC:',      `${agentUsdc.toLocaleString()} µUSDC (${(agentUsdc / 1_000_000).toFixed(2)} test-USDC)`);
  log.detail('Network:',         'Solana devnet');
  console.log('');
  log.agent('All done! Run `npm start` to launch the agent.');
  console.log('');
}

setup().catch(err => {
  log.error(`Setup failed: ${String(err)}`);
  console.error(err);
  process.exit(1);
});
