export type PaymentStatus = 'pending' | 'confirmed' | 'failed';

export interface NetworkConfig {
  network: string;
  rpcUrl: string;
  usdcMint: string;
  explorerUrl: string;
}

export interface SolanaPaymentRequest {
  amount: number;
  recipient: string;
  botId: string;
  domain: string;
}

export interface SolanaPaymentResponse {
  txHash: string;
  status: PaymentStatus;
  timestamp: number;
  explorerUrl: string;
}

export interface TokenAccount {
  address: string;
  balance: number;
  owner: string;
}
