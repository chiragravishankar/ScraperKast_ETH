import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Production: sign + broadcast a USDC SPL transfer from the platform smart
 * wallet to the user-supplied address using the stored private key.
 * Demo: simulate the transfer.
 *
 * POST body: { amountMicroUsdc: number, destinationAddress: string }
 */
export async function POST(req: NextRequest) {
  const { amountMicroUsdc, destinationAddress } =
    await req.json() as { amountMicroUsdc?: number; destinationAddress?: string };

  if (!amountMicroUsdc || amountMicroUsdc < 1_000_000) {
    return NextResponse.json({ error: 'Minimum withdrawal is 1 USDC' }, { status: 400 });
  }
  if (!destinationAddress || !BASE58.test(destinationAddress)) {
    return NextResponse.json({ error: 'Invalid destination address' }, { status: 400 });
  }

  // TODO (production):
  //   const keypair = await SmartWalletService.loadKeypair(currentUser.smartWalletId);
  //   const txSig   = await transferUsdc(connection, keypair, destinationAddress, amountMicroUsdc);
  //   await db.transactions.insert({ type: 'withdrawal', amount: -amountMicroUsdc, txHash: txSig });
  //   return NextResponse.json({ success: true, txHash: txSig });

  await new Promise(r => setTimeout(r, 1_200));

  const txHash = Array.from({ length: 44 }, () =>
    '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'[
      Math.floor(Math.random() * 58)
    ]
  ).join('');

  return NextResponse.json({ success: true, txHash, network: 'devnet' });
}
