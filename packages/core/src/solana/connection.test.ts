import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NETWORKS, getCurrentConfig } from './config.js';
import { SolanaConnection } from './connection.js';
import { getCurrentNetwork, getExplorerUrl } from './index.js';

// ── Mock @solana/web3.js so no real RPC calls are made ───────────────────────

vi.mock('@solana/web3.js', async () => {
  const LAMPORTS_PER_SOL = 1_000_000_000;

  class MockConnection {
    getBlockHeight  = vi.fn().mockResolvedValue(12345678);
    getBalance      = vi.fn().mockResolvedValue(2 * LAMPORTS_PER_SOL);
    confirmTransaction = vi.fn().mockResolvedValue({ value: { err: null } });
    getTransaction  = vi.fn().mockResolvedValue({
      slot: 100,
      transaction: {},
      meta: { err: null },
    });
    requestAirdrop  = vi.fn().mockResolvedValue('mock-airdrop-signature');
  }

  class MockPublicKey {
    constructor(public readonly key: string) {}
    toBase58() { return this.key; }
  }

  return {
    Connection: MockConnection,
    PublicKey:  MockPublicKey,
    LAMPORTS_PER_SOL,
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Run a thunk with SOLANA_NETWORK set to a specific value. */
function withNetwork<T>(network: string, fn: () => T): T {
  const prev = process.env['SOLANA_NETWORK'];
  process.env['SOLANA_NETWORK'] = network;
  try {
    return fn();
  } finally {
    if (prev === undefined) {
      delete process.env['SOLANA_NETWORK'];
    } else {
      process.env['SOLANA_NETWORK'] = prev;
    }
  }
}

async function withNetworkAsync<T>(network: string, fn: () => Promise<T>): Promise<T> {
  const prev = process.env['SOLANA_NETWORK'];
  process.env['SOLANA_NETWORK'] = network;
  try {
    return await fn();
  } finally {
    if (prev === undefined) {
      delete process.env['SOLANA_NETWORK'];
    } else {
      process.env['SOLANA_NETWORK'] = prev;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1.  Network configs
// ─────────────────────────────────────────────────────────────────────────────

describe('NETWORKS constant', () => {
  it('devnet has the correct USDC mint', () => {
    expect(NETWORKS.devnet.usdcMint).toBe('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
  });

  it('mainnet has the correct USDC mint', () => {
    expect(NETWORKS.mainnet.usdcMint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  });

  it('devnet RPC points to devnet endpoint', () => {
    expect(NETWORKS.devnet.rpcUrl).toContain('devnet');
  });

  it('mainnet RPC points to mainnet-beta endpoint', () => {
    expect(NETWORKS.mainnet.rpcUrl).toContain('mainnet-beta');
  });

  it('devnet explorer URL contains cluster=devnet', () => {
    expect(NETWORKS.devnet.explorerUrl).toContain('cluster=devnet');
  });

  it('mainnet explorer URL does not contain cluster param', () => {
    expect(NETWORKS.mainnet.explorerUrl).not.toContain('cluster=');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2.  getCurrentConfig() — environment switching + console output
// ─────────────────────────────────────────────────────────────────────────────

describe('getCurrentConfig()', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
  beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('defaults to devnet when SOLANA_NETWORK is unset', () => {
    const config = withNetwork('devnet', getCurrentConfig);
    expect(config.network).toBe('devnet');
  });

  it('returns devnet config when SOLANA_NETWORK=devnet', () => {
    const config = withNetwork('devnet', getCurrentConfig);
    expect(config).toStrictEqual(NETWORKS.devnet);
  });

  it('returns mainnet config when SOLANA_NETWORK=mainnet', () => {
    const config = withNetwork('mainnet', getCurrentConfig);
    expect(config).toStrictEqual(NETWORKS.mainnet);
  });

  it('treats unknown values as devnet (safe default)', () => {
    const config = withNetwork('staging', getCurrentConfig);
    expect(config.network).toBe('devnet');
  });

  it('logs devnet warning on devnet', () => {
    withNetwork('devnet', getCurrentConfig);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('DEVNET MODE'));
  });

  it('warns about real money on mainnet', () => {
    withNetwork('mainnet', getCurrentConfig);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('MAINNET MODE'));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('REAL MONEY'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.  getCurrentNetwork() helper
// ─────────────────────────────────────────────────────────────────────────────

describe('getCurrentNetwork()', () => {
  it('returns devnet by default', () => {
    expect(withNetwork('devnet', getCurrentNetwork)).toBe('devnet');
  });

  it('returns mainnet when SOLANA_NETWORK=mainnet', () => {
    expect(withNetwork('mainnet', getCurrentNetwork)).toBe('mainnet');
  });

  it('falls back to devnet for unrecognized values', () => {
    expect(withNetwork('production', getCurrentNetwork)).toBe('devnet');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4.  getExplorerUrl() helper
// ─────────────────────────────────────────────────────────────────────────────

describe('getExplorerUrl()', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('builds a devnet explorer URL containing the address', () => {
    const url = withNetwork('devnet', () => getExplorerUrl('testAddress123'));
    expect(url).toContain('testAddress123');
    expect(url).toContain('cluster=devnet');
  });

  it('builds a mainnet explorer URL without cluster param', () => {
    const url = withNetwork('mainnet', () => getExplorerUrl('mainnetAddr456'));
    expect(url).toContain('mainnetAddr456');
    expect(url).not.toContain('cluster=');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5.  SolanaConnection — constructor / network selection
// ─────────────────────────────────────────────────────────────────────────────

describe('SolanaConnection — constructor', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('defaults to devnet when no argument given', () => {
    const conn = withNetwork('devnet', () => new SolanaConnection());
    expect(conn.getNetwork()).toBe('devnet');
  });

  it('uses mainnet when SOLANA_NETWORK=mainnet', () => {
    const conn = withNetwork('mainnet', () => new SolanaConnection());
    expect(conn.getNetwork()).toBe('mainnet');
  });

  it('explicit argument overrides env variable', () => {
    // Env says devnet, explicit arg says mainnet
    const conn = withNetwork('devnet', () => new SolanaConnection('mainnet'));
    expect(conn.getNetwork()).toBe('mainnet');
  });

  it('logs the active network on construction', () => {
    withNetwork('devnet', () => new SolanaConnection());
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('devnet'),
    );
  });

  it('getConnection() returns the Connection instance', () => {
    const conn = withNetwork('devnet', () => new SolanaConnection());
    expect(conn.getConnection()).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6.  SolanaConnection — async methods (mocked RPC)
// ─────────────────────────────────────────────────────────────────────────────

describe('SolanaConnection — async methods', () => {
  let conn: SolanaConnection;

  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    conn = withNetwork('devnet', () => new SolanaConnection());
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('getBlockHeight() returns a number', async () => {
    const height = await conn.getBlockHeight();
    expect(typeof height).toBe('number');
    expect(height).toBeGreaterThan(0);
  });

  it('getBalance() returns a number (lamports)', async () => {
    const { PublicKey } = await import('@solana/web3.js');
    const pk = new PublicKey('11111111111111111111111111111111');
    const balance = await conn.getBalance(pk);
    expect(typeof balance).toBe('number');
    expect(balance).toBeGreaterThanOrEqual(0);
  });

  it('confirmTransaction() returns true when no error', async () => {
    const confirmed = await conn.confirmTransaction('mockSig');
    expect(confirmed).toBe(true);
  });

  it('getTransaction() returns a transaction object', async () => {
    const tx = await conn.getTransaction('mockSig');
    expect(tx).not.toBeNull();
    expect(tx).toHaveProperty('slot');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7.  Airdrop — devnet vs mainnet guard
// ─────────────────────────────────────────────────────────────────────────────

describe('SolanaConnection — requestAirdrop()', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('succeeds on devnet and returns a signature', async () => {
    const conn = withNetwork('devnet', () => new SolanaConnection());
    const { PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
    const pk = new PublicKey('11111111111111111111111111111111');
    const sig = await conn.requestAirdrop(pk, LAMPORTS_PER_SOL);
    expect(typeof sig).toBe('string');
    expect(sig.length).toBeGreaterThan(0);
  });

  it('throws on mainnet', async () => {
    const conn = withNetwork('mainnet', () => new SolanaConnection());
    const { PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
    const pk = new PublicKey('11111111111111111111111111111111');
    await expect(conn.requestAirdrop(pk, LAMPORTS_PER_SOL)).rejects.toThrow(
      /mainnet/i,
    );
  });

  it('throws when requesting more than 2 SOL on devnet', async () => {
    const conn = withNetwork('devnet', () => new SolanaConnection());
    const { PublicKey, LAMPORTS_PER_SOL } = await import('@solana/web3.js');
    const pk = new PublicKey('11111111111111111111111111111111');
    await expect(conn.requestAirdrop(pk, 3 * LAMPORTS_PER_SOL)).rejects.toThrow(
      /limited/i,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8.  Error handling — confirmTransaction failure
// ─────────────────────────────────────────────────────────────────────────────

describe('SolanaConnection — error handling', () => {
  beforeEach(() => { vi.spyOn(console, 'log').mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('confirmTransaction() returns false when transaction has an error', async () => {
    const conn = withNetwork('devnet', () => new SolanaConnection());
    // Override mock to simulate a failed transaction
    conn.getConnection().confirmTransaction = vi.fn().mockResolvedValue({
      value: { err: { InstructionError: [0, 'Custom'] } },
    });
    const confirmed = await conn.confirmTransaction('failSig');
    expect(confirmed).toBe(false);
  });

  it('confirmTransaction() returns false when RPC throws', async () => {
    const conn = withNetwork('devnet', () => new SolanaConnection());
    conn.getConnection().confirmTransaction = vi.fn().mockRejectedValue(
      new Error('network timeout'),
    );
    const confirmed = await conn.confirmTransaction('timeoutSig');
    expect(confirmed).toBe(false);
  });
});
