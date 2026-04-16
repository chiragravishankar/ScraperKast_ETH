import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SolanaPaymentService, USDC_DECIMALS } from './paymentService.js';

// ── Hoist mock state so it's available inside vi.mock() factories ─────────────
// vi.mock calls are hoisted to the top of the file; any variables they reference
// must also be hoisted via vi.hoisted(), otherwise they'd be in TDZ.

const {
  TokenAccountNotFoundError,
  mockGetAssociatedTokenAddress,
  mockGetAccount,
  mockCreateATAInstruction,
  mockCreateTransferInstruction,
} = vi.hoisted(() => {
  class TokenAccountNotFoundError extends Error {
    override name = 'TokenAccountNotFoundError';
    constructor() { super('Token account not found'); }
  }
  return {
    TokenAccountNotFoundError,
    mockGetAssociatedTokenAddress:   vi.fn(),
    mockGetAccount:                  vi.fn(),
    mockCreateATAInstruction:        vi.fn().mockReturnValue({ type: 'create-ata' }),
    mockCreateTransferInstruction:   vi.fn().mockReturnValue({ type: 'transfer'   }),
  };
});

// ── Mock @solana/web3.js ──────────────────────────────────────────────────────

vi.mock('@solana/web3.js', () => {
  class MockPublicKey {
    readonly _key: string;
    constructor(key: string | Uint8Array | number[]) {
      this._key = typeof key === 'string' ? key : 'auto-key';
    }
    toBase58()               { return this._key; }
    toString()               { return this._key; }
    equals(o: MockPublicKey) { return this._key === o._key; }
  }

  class MockTransaction {
    instructions: unknown[] = [];
    recentBlockhash?: string;
    feePayer?: MockPublicKey;
    add(...ixs: unknown[]) {
      this.instructions.push(...ixs.flat());
      return this;
    }
    sign(..._signers: unknown[]) { /* no-op */ }
    serialize() { return Buffer.from('mock-serialized-tx'); }
  }

  class MockKeypair {
    publicKey: MockPublicKey;
    constructor(label = 'keypair') { this.publicKey = new MockPublicKey(label); }
    static generate(label?: string) { return new MockKeypair(label); }
  }

  return {
    Transaction:      MockTransaction,
    PublicKey:        MockPublicKey,
    Keypair:          MockKeypair,
    LAMPORTS_PER_SOL: 1_000_000_000,
    Connection: class {
      getLatestBlockhash = vi.fn().mockResolvedValue({
        blockhash: 'mockBlockhash',
        lastValidBlockHeight: 999,
      });
      sendRawTransaction  = vi.fn().mockResolvedValue('mock-raw-sig');
      confirmTransaction  = vi.fn().mockResolvedValue({ value: { err: null } });
    },
  };
});

// ── Mock @solana/spl-token ────────────────────────────────────────────────────

vi.mock('@solana/spl-token', () => ({
  TokenAccountNotFoundError,
  getAssociatedTokenAddress:               mockGetAssociatedTokenAddress,
  getAccount:                              mockGetAccount,
  createAssociatedTokenAccountInstruction: mockCreateATAInstruction,
  createTransferCheckedInstruction:        mockCreateTransferInstruction,
  TOKEN_PROGRAM_ID:                        'TokenProgram',
  ASSOCIATED_TOKEN_PROGRAM_ID:             'ATAProgram',
}));

// ── Constants & fixtures ──────────────────────────────────────────────────────

const DEVNET_USDC  = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';
const MAINNET_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

const botPK      = { _key: 'botWallet111',      toBase58: () => 'botWallet111'      };
const ownerPK    = { _key: 'ownerWallet222',    toBase58: () => 'ownerWallet222'    };
const platformPK = { _key: 'platformWallet333', toBase58: () => 'platformWallet333' };

const botATA      = { _key: 'botATA',      toBase58: () => 'botATA'      };
const ownerATA    = { _key: 'ownerATA',    toBase58: () => 'ownerATA'    };
const platformATA = { _key: 'platformATA', toBase58: () => 'platformATA' };

function makeParams(basePrice = 1000, scraperKastFee = 50) {
  return {
    botWallet:      botPK,
    ownerWallet:    ownerPK,
    platformWallet: platformPK,
    basePrice,
    scraperKastFee,
    botId:  'gptbot-test',
    domain: 'example.com',
  } as never;
}

function makeMockConn(network: 'devnet' | 'mainnet' = 'devnet') {
  return {
    getNetwork:         vi.fn().mockReturnValue(network),
    getConnection:      vi.fn().mockReturnValue({
      getLatestBlockhash: vi.fn().mockResolvedValue({ blockhash: 'mockBlockhash', lastValidBlockHeight: 100 }),
      sendRawTransaction: vi.fn().mockResolvedValue('mock-sig'),
      confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
    }),
    confirmTransaction: vi.fn().mockResolvedValue(true),
    getTransaction:     vi.fn(),
  };
}

/**
 * Builds a mock confirmed transaction whose token-balance diffs produce
 * the requested ownerReceived / platformReceived values.
 */
function makeConfirmedTx(
  ownerReceived: number,
  platformReceived: number,
  ownerAddr    = 'ownerWallet222',
  platformAddr = 'platformWallet333',
  mint         = DEVNET_USDC,
) {
  const botPre  = ownerReceived + platformReceived + 500;
  return {
    slot:      100,
    blockTime: 1700000000,
    meta: {
      err: null,
      preTokenBalances: [
        { mint, owner: 'botWallet111',  uiTokenAmount: { amount: String(botPre), decimals: 6 } },
      ],
      postTokenBalances: [
        { mint, owner: 'botWallet111', uiTokenAmount: { amount: '500',                        decimals: 6 } },
        { mint, owner: ownerAddr,      uiTokenAmount: { amount: String(ownerReceived),         decimals: 6 } },
        { mint, owner: platformAddr,   uiTokenAmount: { amount: String(platformReceived),      decimals: 6 } },
      ],
    },
    transaction: { signatures: ['mockSig'] },
  };
}

// ── Default mock behaviour restored before every test ────────────────────────

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});

  // ATAs resolve deterministically per wallet.
  mockGetAssociatedTokenAddress.mockImplementation(
    async (_mint: unknown, owner: { toBase58(): string }) => {
      const map: Record<string, unknown> = {
        botWallet111:      botATA,
        ownerWallet222:    ownerATA,
        platformWallet333: platformATA,
      };
      return map[owner.toBase58()] ?? { _key: 'unknownATA', toBase58: () => 'unknownATA' };
    },
  );

  // Bot has 10 000 µUSDC; all token accounts exist by default.
  mockGetAccount.mockImplementation(async (_conn: unknown, ata: { toBase58(): string }) => {
    const amount = ata.toBase58() === 'botATA' ? BigInt(10_000) : BigInt(0);
    return { address: ata, amount };
  });

  mockCreateATAInstruction.mockReturnValue({ type: 'create-ata' });
  mockCreateTransferInstruction.mockReturnValue({ type: 'transfer' });
});

afterEach(() => { vi.restoreAllMocks(); });

// ─────────────────────────────────────────────────────────────────────────────
// 1.  Constants
// ─────────────────────────────────────────────────────────────────────────────

describe('USDC_DECIMALS', () => {
  it('is 6', () => { expect(USDC_DECIMALS).toBe(6); });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2.  createPayment — instruction structure
// ─────────────────────────────────────────────────────────────────────────────

describe('createPayment()', () => {
  it('returns a Transaction', async () => {
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    const tx  = await svc.createPayment(makeParams());
    expect(tx).toBeDefined();
  });

  it('adds two transfer instructions for a normal payment', async () => {
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    await svc.createPayment(makeParams(1000, 50));
    expect(mockCreateTransferInstruction).toHaveBeenCalledTimes(2);
  });

  it('first transfer uses basePrice as amount', async () => {
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    await svc.createPayment(makeParams(1000, 50));
    expect(mockCreateTransferInstruction.mock.calls[0][4]).toBe(BigInt(1000));
  });

  it('second transfer uses scraperKastFee as amount', async () => {
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    await svc.createPayment(makeParams(1000, 50));
    expect(mockCreateTransferInstruction.mock.calls[1][4]).toBe(BigInt(50));
  });

  it('passes USDC_DECIMALS (6) to both transfer instructions', async () => {
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    await svc.createPayment(makeParams(1000, 50));
    for (const call of mockCreateTransferInstruction.mock.calls) {
      expect(call[5]).toBe(6);
    }
  });

  it('omits owner transfer when basePrice is 0', async () => {
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    await svc.createPayment(makeParams(0, 50));
    expect(mockCreateTransferInstruction).toHaveBeenCalledTimes(1);
    expect(mockCreateTransferInstruction.mock.calls[0][4]).toBe(BigInt(50));
  });

  it('omits platform transfer when scraperKastFee is 0', async () => {
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    await svc.createPayment(makeParams(1000, 0));
    expect(mockCreateTransferInstruction).toHaveBeenCalledTimes(1);
    expect(mockCreateTransferInstruction.mock.calls[0][4]).toBe(BigInt(1000));
  });

  it('sets feePayer to botWallet', async () => {
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    const tx  = await svc.createPayment(makeParams()) as never as { feePayer: { toBase58(): string } };
    expect(tx.feePayer.toBase58()).toBe('botWallet111');
  });

  it('prepends one ATA instruction when ownerATA is missing', async () => {
    mockGetAccount.mockImplementation(async (_c: unknown, ata: { toBase58(): string }) => {
      if (ata.toBase58() === 'ownerATA') throw new TokenAccountNotFoundError();
      return { address: ata, amount: BigInt(10_000) };
    });
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    await svc.createPayment(makeParams());
    expect(mockCreateATAInstruction).toHaveBeenCalledTimes(1);
  });

  it('prepends one ATA instruction when platformATA is missing', async () => {
    mockGetAccount.mockImplementation(async (_c: unknown, ata: { toBase58(): string }) => {
      if (ata.toBase58() === 'platformATA') throw new TokenAccountNotFoundError();
      return { address: ata, amount: BigInt(10_000) };
    });
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    await svc.createPayment(makeParams());
    expect(mockCreateATAInstruction).toHaveBeenCalledTimes(1);
  });

  it('prepends two ATA instructions when both are missing', async () => {
    mockGetAccount.mockImplementation(async (_c: unknown, ata: { toBase58(): string }) => {
      if (ata.toBase58() === 'ownerATA' || ata.toBase58() === 'platformATA') {
        throw new TokenAccountNotFoundError();
      }
      return { address: ata, amount: BigInt(10_000) };
    });
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    await svc.createPayment(makeParams());
    expect(mockCreateATAInstruction).toHaveBeenCalledTimes(2);
  });

  it('throws on insufficient USDC balance', async () => {
    mockGetAccount.mockImplementation(async (_c: unknown, ata: { toBase58(): string }) => {
      if (ata.toBase58() === 'botATA') return { address: ata, amount: BigInt(10) };
      return { address: ata, amount: BigInt(0) };
    });
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    await expect(svc.createPayment(makeParams(1000, 50))).rejects.toThrow(/insufficient/i);
  });

  it('re-throws unexpected errors from getAccount', async () => {
    mockGetAccount.mockImplementation(async (_c: unknown, ata: { toBase58(): string }) => {
      if (ata.toBase58() === 'ownerATA') throw new Error('network timeout');
      return { address: ata, amount: BigInt(10_000) };
    });
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    await expect(svc.createPayment(makeParams())).rejects.toThrow('network timeout');
  });

  it('uses mainnet USDC mint when network is mainnet', async () => {
    const svc = new SolanaPaymentService(makeMockConn('mainnet') as never, platformPK as never);
    await svc.createPayment(makeParams());
    const mintArg = mockGetAssociatedTokenAddress.mock.calls[0][0] as { _key: string };
    expect(mintArg._key).toBe(MAINNET_USDC);
  });

  it('uses devnet USDC mint when network is devnet', async () => {
    const svc = new SolanaPaymentService(makeMockConn('devnet') as never, platformPK as never);
    await svc.createPayment(makeParams());
    const mintArg = mockGetAssociatedTokenAddress.mock.calls[0][0] as { _key: string };
    expect(mintArg._key).toBe(DEVNET_USDC);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.  executePayment
// ─────────────────────────────────────────────────────────────────────────────

describe('executePayment()', () => {
  it('returns a signature string', async () => {
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    const tx  = await svc.createPayment(makeParams());
    const { Keypair } = await import('@solana/web3.js');
    const sig = await svc.executePayment(tx, new Keypair('bot') as never);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
  });

  it('sets recentBlockhash on the transaction', async () => {
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    const tx  = await svc.createPayment(makeParams());
    const { Keypair } = await import('@solana/web3.js');
    await svc.executePayment(tx, new Keypair('bot') as never);
    expect((tx as never as { recentBlockhash: string }).recentBlockhash).toBe('mockBlockhash');
  });

  it('logs the explorer URL after execution', async () => {
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    const tx  = await svc.createPayment(makeParams());
    const { Keypair } = await import('@solana/web3.js');
    await svc.executePayment(tx, new Keypair('bot') as never);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Explorer'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4.  verifyPayment — confirmed
// ─────────────────────────────────────────────────────────────────────────────

describe('verifyPayment() — confirmed', () => {
  it('isValid is true', async () => {
    const conn = makeMockConn();
    conn.getTransaction.mockResolvedValue(makeConfirmedTx(1000, 50));
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    expect((await svc.verifyPayment('sig')).isValid).toBe(true);
  });

  it('status is confirmed', async () => {
    const conn = makeMockConn();
    conn.getTransaction.mockResolvedValue(makeConfirmedTx(1000, 50));
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    expect((await svc.verifyPayment('sig')).status).toBe('confirmed');
  });

  it('ownerReceived matches basePrice', async () => {
    const conn = makeMockConn();
    conn.getTransaction.mockResolvedValue(makeConfirmedTx(1000, 50));
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    expect((await svc.verifyPayment('sig')).ownerReceived).toBe(1000);
  });

  it('platformReceived matches scraperKastFee', async () => {
    const conn = makeMockConn();
    conn.getTransaction.mockResolvedValue(makeConfirmedTx(1000, 50));
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    expect((await svc.verifyPayment('sig')).platformReceived).toBe(50);
  });

  it('actualAmount = ownerReceived + platformReceived', async () => {
    const conn = makeMockConn();
    conn.getTransaction.mockResolvedValue(makeConfirmedTx(1000, 50));
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    const v   = await svc.verifyPayment('sig');
    expect(v.actualAmount).toBe(v.ownerReceived + v.platformReceived);
  });

  it('expectedAmount equals actualAmount', async () => {
    const conn = makeMockConn();
    conn.getTransaction.mockResolvedValue(makeConfirmedTx(1000, 50));
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    const v   = await svc.verifyPayment('sig');
    expect(v.expectedAmount).toBe(v.actualAmount);
  });

  it('echoes the txSignature', async () => {
    const conn = makeMockConn();
    conn.getTransaction.mockResolvedValue(makeConfirmedTx(1000, 50));
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    expect((await svc.verifyPayment('my-sig')).txSignature).toBe('my-sig');
  });

  it('devnet explorer URL contains cluster=devnet and signature', async () => {
    const conn = makeMockConn('devnet');
    conn.getTransaction.mockResolvedValue(makeConfirmedTx(1000, 50));
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    const url = (await svc.verifyPayment('my-sig')).explorerUrl;
    expect(url).toContain('cluster=devnet');
    expect(url).toContain('my-sig');
  });

  it('mainnet explorer URL has no cluster param', async () => {
    const conn = makeMockConn('mainnet');
    conn.getTransaction.mockResolvedValue(makeConfirmedTx(1000, 50, 'ownerWallet222', 'platformWallet333', MAINNET_USDC));
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    const url = (await svc.verifyPayment('my-sig')).explorerUrl;
    expect(url).not.toContain('cluster=');
    expect(url).toContain('my-sig');
  });

  it('distinguishes platform from owner correctly', async () => {
    const conn = makeMockConn();
    conn.getTransaction.mockResolvedValue(makeConfirmedTx(2000, 100));
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    const v   = await svc.verifyPayment('sig');
    expect(v.ownerReceived).toBe(2000);
    expect(v.platformReceived).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.  verifyPayment — failed / missing
// ─────────────────────────────────────────────────────────────────────────────

describe('verifyPayment() — failed / missing', () => {
  it('isValid=false when tx not found', async () => {
    const conn = makeMockConn();
    conn.getTransaction.mockResolvedValue(null);
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    expect((await svc.verifyPayment('ghost')).isValid).toBe(false);
  });

  it('status=failed when tx is null', async () => {
    const conn = makeMockConn();
    conn.getTransaction.mockResolvedValue(null);
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    expect((await svc.verifyPayment('ghost')).status).toBe('failed');
  });

  it('isValid=false when meta.err is set', async () => {
    const conn = makeMockConn();
    conn.getTransaction.mockResolvedValue({
      slot: 1,
      meta: { err: { InstructionError: [0, 'Custom'] }, preTokenBalances: [], postTokenBalances: [] },
      transaction: {},
    });
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    const v = await svc.verifyPayment('fail-sig');
    expect(v.isValid).toBe(false);
    expect(v.status).toBe('failed');
  });

  it('all amounts are 0 when meta is null', async () => {
    const conn = makeMockConn();
    conn.getTransaction.mockResolvedValue({ slot: 1, meta: null, transaction: {} });
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    const v = await svc.verifyPayment('no-meta');
    expect(v.ownerReceived).toBe(0);
    expect(v.platformReceived).toBe(0);
    expect(v.actualAmount).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6.  getPaymentStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('getPaymentStatus()', () => {
  it('returns confirmed when confirmTransaction is true', async () => {
    const conn = makeMockConn();
    conn.confirmTransaction.mockResolvedValue(true);
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    expect(await svc.getPaymentStatus('sig')).toBe('confirmed');
  });

  it('returns failed when confirmTransaction is false', async () => {
    const conn = makeMockConn();
    conn.confirmTransaction.mockResolvedValue(false);
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    expect(await svc.getPaymentStatus('sig')).toBe('failed');
  });

  it('returns failed when confirmTransaction throws', async () => {
    const conn = makeMockConn();
    conn.confirmTransaction.mockRejectedValue(new Error('timeout'));
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    expect(await svc.getPaymentStatus('sig')).toBe('failed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7.  createTokenAccountIfNeeded
// ─────────────────────────────────────────────────────────────────────────────

describe('createTokenAccountIfNeeded()', () => {
  it('returns the ATA when account exists', async () => {
    mockGetAccount.mockResolvedValue({ address: ownerATA, amount: BigInt(0) });
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    const ata = await svc.createTokenAccountIfNeeded(ownerPK as never);
    expect(ata).toBeDefined();
  });

  it('returns the ATA even when account does not exist', async () => {
    mockGetAccount.mockRejectedValue(new TokenAccountNotFoundError());
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    const ata = await svc.createTokenAccountIfNeeded(ownerPK as never);
    expect(ata).toBeDefined();
  });

  it('logs "not found" when account is missing', async () => {
    mockGetAccount.mockRejectedValue(new TokenAccountNotFoundError());
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    await svc.createTokenAccountIfNeeded(ownerPK as never);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('not found'));
  });

  it('re-throws unexpected errors', async () => {
    mockGetAccount.mockRejectedValue(new Error('RPC error'));
    const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
    await expect(svc.createTokenAccountIfNeeded(ownerPK as never)).rejects.toThrow('RPC error');
  });

  it('uses mainnet USDC mint on mainnet', async () => {
    const svc = new SolanaPaymentService(makeMockConn('mainnet') as never, platformPK as never);
    await svc.createTokenAccountIfNeeded(ownerPK as never);
    const mintArg = mockGetAssociatedTokenAddress.mock.calls[0][0] as { _key: string };
    expect(mintArg._key).toBe(MAINNET_USDC);
  });

  it('uses devnet USDC mint on devnet', async () => {
    const svc = new SolanaPaymentService(makeMockConn('devnet') as never, platformPK as never);
    await svc.createTokenAccountIfNeeded(ownerPK as never);
    const mintArg = mockGetAssociatedTokenAddress.mock.calls[0][0] as { _key: string };
    expect(mintArg._key).toBe(DEVNET_USDC);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8.  95 / 5 revenue-split invariants
// ─────────────────────────────────────────────────────────────────────────────

describe('95/5 revenue-split invariants', () => {
  const cases: Array<[number, number, number]> = [
    [950,  50,   1000],
    [1900, 100,  2000],
    [4750, 250,  5000],
    [9500, 500, 10000],
  ];

  for (const [base, fee, total] of cases) {
    it(`base=${base} + fee=${fee} = total=${total}`, async () => {
      const svc = new SolanaPaymentService(makeMockConn() as never, platformPK as never);
      await svc.createPayment(makeParams(base, fee));

      const [ownerCall, platformCall] = mockCreateTransferInstruction.mock.calls;
      expect(Number(ownerCall[4])).toBe(base);
      expect(Number(platformCall[4])).toBe(fee);
      expect(Number(ownerCall[4]) + Number(platformCall[4])).toBe(total);
    });
  }

  it('verify: ownerReceived + platformReceived = totalPrice', async () => {
    const conn = makeMockConn();
    conn.getTransaction.mockResolvedValue(makeConfirmedTx(950, 50));
    const svc = new SolanaPaymentService(conn as never, platformPK as never);
    const v   = await svc.verifyPayment('sig');
    expect(v.ownerReceived + v.platformReceived).toBe(1000);
  });
});
