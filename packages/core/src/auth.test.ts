import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { AuthService } from './auth.js';
import type { TokenPayload } from './auth.js';

const SECRET = 'test-secret-at-least-32-chars-long!!';
const OTHER_SECRET = 'completely-different-secret-value!!';

const SAMPLE: Pick<TokenPayload, 'botId' | 'credits' | 'allowedDomains'> = {
  botId: 'openai',
  credits: 500,
  allowedDomains: ['example.com', 'blog.example.com'],
};

// ─── constructor ──────────────────────────────────────────────────────────────

describe('AuthService constructor', () => {
  it('accepts a valid secret', () => {
    expect(() => new AuthService(SECRET)).not.toThrow();
  });

  it('throws on empty string secret', () => {
    expect(() => new AuthService('')).toThrow('secret must be a non-empty string');
  });

  it('throws on whitespace-only secret', () => {
    expect(() => new AuthService('   ')).toThrow('secret must be a non-empty string');
  });
});

// ─── generateToken ────────────────────────────────────────────────────────────

describe('generateToken', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(SECRET);
  });

  it('returns a string with three JWT segments', () => {
    const token = service.generateToken(SAMPLE.botId, SAMPLE.credits, SAMPLE.allowedDomains);
    expect(token.split('.')).toHaveLength(3);
  });

  it('embeds botId in the payload', () => {
    const token = service.generateToken(SAMPLE.botId, SAMPLE.credits, SAMPLE.allowedDomains);
    const decoded = jwt.decode(token) as TokenPayload;
    expect(decoded.botId).toBe(SAMPLE.botId);
  });

  it('embeds credits in the payload', () => {
    const token = service.generateToken(SAMPLE.botId, SAMPLE.credits, SAMPLE.allowedDomains);
    const decoded = jwt.decode(token) as TokenPayload;
    expect(decoded.credits).toBe(SAMPLE.credits);
  });

  it('embeds allowedDomains in the payload', () => {
    const token = service.generateToken(SAMPLE.botId, SAMPLE.credits, SAMPLE.allowedDomains);
    const decoded = jwt.decode(token) as TokenPayload;
    expect(decoded.allowedDomains).toEqual(SAMPLE.allowedDomains);
  });

  it('sets expiry ~1 hour from now', () => {
    const before = Math.floor(Date.now() / 1000);
    const token = service.generateToken(SAMPLE.botId, SAMPLE.credits, SAMPLE.allowedDomains);
    const after = Math.floor(Date.now() / 1000);
    const decoded = jwt.decode(token) as TokenPayload;

    expect(decoded.exp).toBeGreaterThanOrEqual(before + 3600);
    expect(decoded.exp).toBeLessThanOrEqual(after + 3600);
  });

  it('uses HS256 algorithm', () => {
    const token = service.generateToken(SAMPLE.botId, SAMPLE.credits, SAMPLE.allowedDomains);
    const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
    expect(header.alg).toBe('HS256');
  });

  it('produces different tokens for different botIds', () => {
    const t1 = service.generateToken('openai', SAMPLE.credits, SAMPLE.allowedDomains);
    const t2 = service.generateToken('anthropic', SAMPLE.credits, SAMPLE.allowedDomains);
    expect(t1).not.toBe(t2);
  });
});

// ─── verifyToken — valid ──────────────────────────────────────────────────────

describe('verifyToken — valid token', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(SECRET);
  });

  it('returns a TokenPayload for a freshly issued token', () => {
    const token = service.generateToken(SAMPLE.botId, SAMPLE.credits, SAMPLE.allowedDomains);
    const result = service.verifyToken(token);
    expect(result).not.toBeNull();
  });

  it('returns the correct botId', () => {
    const token = service.generateToken(SAMPLE.botId, SAMPLE.credits, SAMPLE.allowedDomains);
    expect(service.verifyToken(token)?.botId).toBe(SAMPLE.botId);
  });

  it('returns the correct credits', () => {
    const token = service.generateToken(SAMPLE.botId, SAMPLE.credits, SAMPLE.allowedDomains);
    expect(service.verifyToken(token)?.credits).toBe(SAMPLE.credits);
  });

  it('returns the correct allowedDomains', () => {
    const token = service.generateToken(SAMPLE.botId, SAMPLE.credits, SAMPLE.allowedDomains);
    expect(service.verifyToken(token)?.allowedDomains).toEqual(SAMPLE.allowedDomains);
  });

  it('returns a numeric exp timestamp', () => {
    const token = service.generateToken(SAMPLE.botId, SAMPLE.credits, SAMPLE.allowedDomains);
    const payload = service.verifyToken(token);
    expect(typeof payload?.exp).toBe('number');
    expect(payload!.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('roundtrips zero credits', () => {
    const token = service.generateToken(SAMPLE.botId, 0, SAMPLE.allowedDomains);
    expect(service.verifyToken(token)?.credits).toBe(0);
  });

  it('roundtrips an empty domains array', () => {
    const token = service.generateToken(SAMPLE.botId, SAMPLE.credits, []);
    expect(service.verifyToken(token)?.allowedDomains).toEqual([]);
  });
});

// ─── verifyToken — expired ────────────────────────────────────────────────────

describe('verifyToken — expired token', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for a token whose exp is in the past', () => {
    // Sign a token that expires 2 seconds in the future, then fast-forward time.
    const token = jwt.sign(
      { botId: 'openai', credits: 100, allowedDomains: [] },
      SECRET,
      { algorithm: 'HS256', expiresIn: 2 },
    );

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 10_000); // +10 s → definitely expired

    const service = new AuthService(SECRET);
    expect(service.verifyToken(token)).toBeNull();
  });
});

// ─── verifyToken — invalid signature ─────────────────────────────────────────

describe('verifyToken — invalid signature', () => {
  it('returns null when the token was signed with a different secret', () => {
    const tokenFromOther = new AuthService(OTHER_SECRET).generateToken(
      SAMPLE.botId, SAMPLE.credits, SAMPLE.allowedDomains,
    );
    const service = new AuthService(SECRET);
    expect(service.verifyToken(tokenFromOther)).toBeNull();
  });

  it('returns null when the signature segment is tampered with', () => {
    const service = new AuthService(SECRET);
    const token = service.generateToken(SAMPLE.botId, SAMPLE.credits, SAMPLE.allowedDomains);
    const [header, payload] = token.split('.');
    const tampered = `${header}.${payload}.invalidsignature`;
    expect(service.verifyToken(tampered)).toBeNull();
  });

  it('returns null when the payload is modified after signing', () => {
    const service = new AuthService(SECRET);
    const token = service.generateToken(SAMPLE.botId, SAMPLE.credits, SAMPLE.allowedDomains);
    const [header, , signature] = token.split('.');
    const fakePayload = Buffer.from(JSON.stringify({ botId: 'hacker', credits: 999999, allowedDomains: [] })).toString('base64url');
    const tampered = `${header}.${fakePayload}.${signature}`;
    expect(service.verifyToken(tampered)).toBeNull();
  });
});

// ─── verifyToken — malformed input ───────────────────────────────────────────

describe('verifyToken — malformed input', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService(SECRET);
  });

  it('returns null for an empty string', () => {
    expect(service.verifyToken('')).toBeNull();
  });

  it('returns null for a random string', () => {
    expect(service.verifyToken('not.a.jwt')).toBeNull();
  });

  it('returns null for a token with only two segments', () => {
    expect(service.verifyToken('header.payload')).toBeNull();
  });

  it('returns null for a plain JSON string', () => {
    expect(service.verifyToken(JSON.stringify({ botId: 'x' }))).toBeNull();
  });

  it('returns null for a token signed with RS256 (wrong algorithm)', () => {
    // Forge a header claiming RS256 but with a symmetric secret — jwt.verify
    // should reject it because we only accept HS256.
    const fakeHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const fakePayload = Buffer.from(JSON.stringify({ botId: 'x', credits: 0, allowedDomains: [] })).toString('base64url');
    const token = `${fakeHeader}.${fakePayload}.fakesig`;
    expect(service.verifyToken(token)).toBeNull();
  });
});
