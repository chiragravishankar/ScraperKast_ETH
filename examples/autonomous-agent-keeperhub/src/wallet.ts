/**
 * Ethereum wallet helpers for the KeeperHub agent.
 * All on-chain reads and writes go through here.
 */
import { ethers } from 'ethers';
import { log } from './logger.js';

// ── Minimal ERC-20 ABI ────────────────────────────────────────────────────────

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

// ── Wallet loading ─────────────────────────────────────────────────────────────

export function loadWallet(provider: ethers.JsonRpcProvider): ethers.Wallet {
  const key = process.env.AGENT_PRIVATE_KEY;
  if (!key) {
    throw new Error('AGENT_PRIVATE_KEY not set. Run `npm run setup` first.');
  }
  return new ethers.Wallet(key, provider);
}

// ── Balance queries ───────────────────────────────────────────────────────────

export async function getEthBalance(wallet: ethers.Wallet): Promise<bigint> {
  return wallet.provider!.getBalance(wallet.address);
}

export async function getUsdcBalance(
  wallet: ethers.Wallet,
  usdcAddress: string
): Promise<bigint> {
  const contract = new ethers.Contract(usdcAddress, ERC20_ABI, wallet.provider);
  return contract.balanceOf(wallet.address) as Promise<bigint>;
}

// ── ERC-20 operations ─────────────────────────────────────────────────────────

/**
 * Approve a spender (e.g. a KeeperHub relayer) to spend USDC on the agent's behalf.
 * Returns the transaction receipt.
 */
export async function approveUsdc(
  wallet: ethers.Wallet,
  spender: string,
  amount: bigint,
  usdcAddress: string
): Promise<ethers.TransactionReceipt> {
  const contract = new ethers.Contract(usdcAddress, ERC20_ABI, wallet);
  const tx: ethers.ContractTransactionResponse = await contract.approve(spender, amount);
  log.chain(`Approve tx: ${tx.hash}`);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('Approve transaction receipt was null');
  return receipt;
}

/**
 * Transfer USDC directly from the agent wallet to a recipient.
 * Used in `direct` mode (bypasses KeeperHub).
 * Returns the confirmed transaction hash.
 */
export async function transferUsdc(
  wallet: ethers.Wallet,
  recipient: string,
  amount: bigint,
  usdcAddress: string
): Promise<string> {
  const contract = new ethers.Contract(usdcAddress, ERC20_ABI, wallet);
  const tx: ethers.ContractTransactionResponse = await contract.transfer(recipient, amount);
  log.chain(`Transfer tx submitted: ${tx.hash}`);
  const receipt = await tx.wait();
  if (!receipt) throw new Error('Transfer transaction receipt was null');
  if (receipt.status !== 1) throw new Error(`Transfer reverted in tx ${tx.hash}`);
  log.chain(`Transfer confirmed in block ${receipt.blockNumber}`);
  return tx.hash;
}

// ── Signing helpers ───────────────────────────────────────────────────────────

/**
 * Signs a payment authorisation that KeeperHub uses to verify the agent
 * approved the execution before submitting it on-chain.
 *
 * Message = keccak256(abi.encodePacked(token, recipient, amount))
 */
export async function signPayment(
  wallet: ethers.Wallet,
  usdcAddress: string,
  recipient: string,
  amount: bigint
): Promise<string> {
  const msgHash = ethers.solidityPackedKeccak256(
    ['address', 'address', 'uint256'],
    [usdcAddress, recipient, amount]
  );
  return wallet.signMessage(ethers.getBytes(msgHash));
}
