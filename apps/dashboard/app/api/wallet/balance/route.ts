import { NextResponse } from 'next/server';
import { clusterApiUrl, Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';

export const dynamic = 'force-dynamic';

// Demo smart wallet — in production this comes from the authenticated user's DB record
const DEMO_SMART_WALLET = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
const DEVNET_USDC_MINT  = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

async function fetchUsdcBalance(
  connection: Connection,
  walletAddress: string,
): Promise<number> {
  const owner = new PublicKey(walletAddress);
  try {
    const ata     = await getAssociatedTokenAddress(DEVNET_USDC_MINT, owner);
    const account = await getAccount(connection, ata);
    return Number(account.amount); // µUSDC (6 decimals)
  } catch (err) {
    const name = (err as Error).name;
    if (
      name === 'TokenAccountNotFoundError' ||
      name === 'TokenInvalidAccountOwnerError'
    ) {
      return 0; // wallet has no USDC token account yet
    }
    throw err;
  }
}

export async function GET() {
  const network = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? 'devnet') as 'devnet' | 'mainnet';

  let balance = 0;
  try {
    const cluster    = network === 'mainnet' ? 'mainnet-beta' : 'devnet';
    const endpoint   = clusterApiUrl(cluster);
    const connection = new Connection(endpoint, 'confirmed');
    balance = await fetchUsdcBalance(connection, DEMO_SMART_WALLET);
  } catch {
    // RPC unavailable in test / build environments — return 0 gracefully
    balance = 0;
  }

  return NextResponse.json({
    smartWalletAddress: DEMO_SMART_WALLET,
    balance,
    network,
  });
}
