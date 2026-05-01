/**
 * One-time setup for the KeeperHub autonomous agent.
 * Safe to run multiple times — reads existing wallet from .env when present.
 *
 * What this does:
 *   1. Loads agent wallet from AGENT_PRIVATE_KEY (or generates a new one)
 *   2. Checks Sepolia ETH balance — prints faucet link if insufficient
 *   3. Writes (or updates) .env with all resolved values
 *
 * Note: No test-token minting needed — the agent uses real Sepolia USDC
 *       (Circle testnet: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238)
 *       funded from the Sepolia USDC faucet at https://faucet.circle.com
 *
 * Run: npm run setup
 */

import * as dotenv from 'dotenv';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import { log } from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH  = path.join(__dirname, '..', '.env');

// ── Load existing .env before anything else ───────────────────────────────────

const envExists = fs.existsSync(ENV_PATH);
if (envExists) {
  dotenv.config({ path: ENV_PATH });
} else {
  dotenv.config();
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ETHEREUM_RPC  = process.env.ETHEREUM_RPC_URL ?? 'https://rpc.sepolia.org';
const USDC_CONTRACT = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const MIN_ETH_WEI   = ethers.parseEther('0.01'); // 0.01 Sepolia ETH needed for gas

// ── Wallet helpers ────────────────────────────────────────────────────────────

function loadOrGenerate(): { wallet: ethers.Wallet; isNew: boolean } {
  const raw = process.env.AGENT_PRIVATE_KEY;

  if (raw) {
    try {
      const wallet = new ethers.Wallet(raw);
      log.info(`Agent: loaded existing wallet ${wallet.address}`);
      return { wallet, isNew: false };
    } catch {
      log.info('AGENT_PRIVATE_KEY present but invalid — generating a fresh wallet');
    }
  }

  const wallet = ethers.Wallet.createRandom();
  log.success(`Agent: generated new wallet ${wallet.address}`);
  return { wallet, isNew: true };
}

// ── Balance check ─────────────────────────────────────────────────────────────

async function checkEthBalance(
  provider: ethers.JsonRpcProvider,
  address: string
): Promise<boolean> {
  try {
    const balance = await provider.getBalance(address);
    const eth     = ethers.formatEther(balance);
    if (balance >= MIN_ETH_WEI) {
      log.info(`Agent has ${Number(eth).toFixed(6)} Sepolia ETH — sufficient for gas ✓`);
      return true;
    }
    log.info(`Agent has ${Number(eth).toFixed(6)} Sepolia ETH (need ≥ 0.01 for gas)`);
    return false;
  } catch (err) {
    log.error(`Could not check balance: ${String(err)}`);
    return false;
  }
}

// ── USDC balance check ────────────────────────────────────────────────────────

const ERC20_ABI = ['function balanceOf(address) view returns (uint256)'];

async function checkUsdcBalance(
  provider: ethers.JsonRpcProvider,
  address:  string
): Promise<bigint> {
  try {
    const contract = new ethers.Contract(USDC_CONTRACT, ERC20_ABI, provider);
    const bal      = await contract.balanceOf(address) as bigint;
    return bal;
  } catch {
    return 0n;
  }
}

// ── .env writer ───────────────────────────────────────────────────────────────

function writeEnv(
  wallet:            ethers.Wallet,
  platformWallet:    string,
  keeperhubApiKey:   string,
  ethereumRpc:       string
): void {
  const lines = [
    '# ── Generated/updated by npm run setup ───────────────────────────────────────',
    `AGENT_PRIVATE_KEY=${wallet.privateKey}`,
    `AGENT_ADDRESS=${wallet.address}`,
    '',
    '# ── Platform Wallet (receives payments) ──────────────────────────────────────',
    `PLATFORM_WALLET_ADDRESS=${platformWallet}`,
    '',
    '# ── KeeperHub ────────────────────────────────────────────────────────────────',
    `KEEPERHUB_API_KEY=${keeperhubApiKey}`,
    'KEEPERHUB_API_URL=https://api.keeperhub.ai/v1',
    '# Set to "direct" to bypass KeeperHub (testing without API key)',
    'KEEPERHUB_MODE=keeperhub',
    '',
    '# ── Ethereum Network (Sepolia testnet) ───────────────────────────────────────',
    `ETHEREUM_RPC_URL=${ethereumRpc}`,
    '# Sepolia USDC (Circle testnet)',
    `USDC_CONTRACT=${USDC_CONTRACT}`,
    '',
    '# ── Target endpoints ─────────────────────────────────────────────────────────',
    'BASE_URL=http://localhost:3001',
    'TARGET_ENDPOINT=http://localhost:3001/api/test-content-eth',
    'VERIFY_ENDPOINT=http://localhost:3001/api/test-content-eth/verify',
    '',
    '# ── Agent configuration ──────────────────────────────────────────────────────',
    'AGENT_GOAL=Find and access content about AI trends',
    'MAX_PRICE_USDC=10000',
  ];

  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf-8');
  log.success(`.env saved → ${ENV_PATH}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function setup() {
  log.banner();

  if (envExists) {
    log.section('SETUP — RESUMING (existing .env found)');
    log.info('Wallet will be reused if valid. Only missing resources will be updated.');
  } else {
    log.section('SETUP — FIRST RUN (no .env found)');
    log.info('Generating a new Ethereum wallet for the agent.');
  }

  // ── 1. Wallet ────────────────────────────────────────────────────────────────
  log.section('1/3  Agent Wallet');
  const { wallet } = loadOrGenerate();

  // Resolve config from env or use defaults
  const platformWallet  = process.env.PLATFORM_WALLET_ADDRESS ?? '';
  const keeperhubApiKey = process.env.KEEPERHUB_API_KEY ?? '';
  const ethereumRpc     = process.env.ETHEREUM_RPC_URL ?? 'https://rpc.sepolia.org';

  // ── 2. Balance checks ────────────────────────────────────────────────────────
  log.section('2/3  Sepolia Balances');

  let hasSufficientEth  = false;
  let usdcBalance       = 0n;

  try {
    const provider = new ethers.JsonRpcProvider(ethereumRpc);
    hasSufficientEth = await checkEthBalance(provider, wallet.address);
    usdcBalance      = await checkUsdcBalance(provider, wallet.address);

    const usdcFormatted = (Number(usdcBalance) / 1_000_000).toFixed(6);
    log.detail('USDC balance:', `${usdcBalance.toString()} µUSDC ($${usdcFormatted})`);
  } catch (err) {
    log.error(`Could not connect to ${ethereumRpc}: ${String(err)}`);
    log.info('Skipping balance checks — save .env and fund manually.');
  }

  // ── 3. Write .env ────────────────────────────────────────────────────────────
  log.section('3/3  Writing .env');
  writeEnv(wallet, platformWallet, keeperhubApiKey, ethereumRpc);

  // ── Funding instructions if needed ───────────────────────────────────────────
  console.log('');

  if (!hasSufficientEth) {
    console.log('⚠️  Agent wallet needs Sepolia ETH for gas fees:');
    console.log(`   Address: ${wallet.address}`);
    console.log('   Faucets:');
    console.log('     https://sepoliafaucet.com');
    console.log('     https://faucet.quicknode.com/ethereum/sepolia');
    console.log('');
  }

  if (usdcBalance === 0n) {
    console.log('⚠️  Agent wallet needs Sepolia USDC to pay for content:');
    console.log(`   Address: ${wallet.address}`);
    console.log(`   USDC contract: ${USDC_CONTRACT}`);
    console.log('   Get testnet USDC: https://faucet.circle.com');
    console.log('');
  }

  if (!platformWallet) {
    console.log('⚠️  PLATFORM_WALLET_ADDRESS not set.');
    console.log('   Edit .env and add the Ethereum address that receives payments.');
    console.log('');
  }

  if (!keeperhubApiKey) {
    console.log('⚠️  KEEPERHUB_API_KEY not set.');
    console.log('   Get your API key at: https://app.keeperhub.ai');
    console.log('   Or set KEEPERHUB_MODE=direct in .env to bypass KeeperHub for testing.');
    console.log('');
  }

  // ── Setup complete summary ────────────────────────────────────────────────────
  log.section('SETUP COMPLETE');
  log.detail('Agent address:',    wallet.address);
  log.detail('Platform wallet:',  platformWallet || '(not set — edit .env)');
  log.detail('USDC balance:',     `${usdcBalance.toString()} µUSDC`);
  log.detail('KeeperHub mode:',   keeperhubApiKey ? 'keeperhub' : 'direct (no API key)');
  log.detail('Network:',          'Ethereum Sepolia');
  console.log('');

  if (hasSufficientEth && usdcBalance > 0n && platformWallet) {
    log.agent('All funded! Run `npm start` to launch the agent.');
  } else {
    log.agent('Fund the wallet then run `npm run setup` again to verify, then `npm start`.');
  }

  console.log('');
}

setup().catch(err => {
  log.error(`Setup failed: ${String(err)}`);
  console.error(err);
  process.exit(1);
});
