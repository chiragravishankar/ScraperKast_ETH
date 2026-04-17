import type { SessionData, SessionStatus } from './types.js';

/** Default session lifetime: 1 hour. */
const DEFAULT_TTL_MS = 60 * 60 * 1000;

/**
 * In-memory store for Dodo checkout sessions.
 *
 * Tracks the lifecycle of each checkout: pending → completed / expired / failed.
 * Expired sessions are pruned by `cleanup()` (call periodically via `setInterval`).
 *
 * For production deployments with multiple server instances, replace this with a
 * Redis-backed implementation that shares state across processes.
 */
export class SessionStore {
  private readonly sessions = new Map<string, SessionData>();
  private readonly ttlMs: number;

  constructor(ttlMs = DEFAULT_TTL_MS) {
    this.ttlMs = ttlMs;
  }

  // ── Write ─────────────────────────────────────────────────────────────────

  /** Create or overwrite a session entry. */
  set(sessionId: string, data: SessionData): void {
    this.sessions.set(sessionId, data);
  }

  /**
   * Partially update an existing session.
   * Returns `false` if the session does not exist or has expired.
   */
  update(sessionId: string, updates: Partial<SessionData>): boolean {
    const existing = this.getRaw(sessionId);
    if (!existing) return false;
    this.sessions.set(sessionId, { ...existing, ...updates });
    return true;
  }

  /** Remove a session unconditionally. */
  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  /**
   * Retrieve a session.  Returns `null` if not found or expired.
   * Expired sessions are removed on access.
   */
  get(sessionId: string): SessionData | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    if (session.expiresAt < Date.now()) {
      this.sessions.delete(sessionId);
      return null;
    }

    return session;
  }

  /** Check whether a session exists and is not expired. */
  has(sessionId: string): boolean {
    return this.get(sessionId) !== null;
  }

  // ── Status helpers ────────────────────────────────────────────────────────

  /** Convenience: update only the status field. */
  setStatus(sessionId: string, status: SessionStatus): boolean {
    return this.update(sessionId, { status });
  }

  /** Convenience: mark session as completed with tx hash and access token. */
  complete(sessionId: string, txHash: string, accessToken: string): boolean {
    return this.update(sessionId, {
      status:      'completed',
      txHash,
      accessToken,
    });
  }

  // ── Maintenance ───────────────────────────────────────────────────────────

  /** Remove all expired sessions. Call periodically (e.g. every 5 minutes). */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (session.expiresAt < now) {
        this.sessions.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /** Number of active (non-expired) sessions currently held. */
  get size(): number {
    this.cleanup();
    return this.sessions.size;
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  /** Get session without expiry check (used by `update`). */
  private getRaw(sessionId: string): SessionData | undefined {
    return this.sessions.get(sessionId);
  }
}
