export interface BotAccessEvent {
  timestamp: number;
  botName: string;
  path: string;
  allowed: boolean;
  price?: number;
}

export interface PaymentRequiredEvent {
  timestamp: number;
  botName: string;
  path: string;
  price: number;
}

export interface TopEntry {
  name: string;
  requests: number;
  revenue: number;
}

export interface AnalyticsStats {
  totalRequests: number;
  paidRequests: number;
  /** Total revenue in the same unit as `price` (e.g. micro-dollars). */
  revenue: number;
  /** Most active bots, sorted by request count descending. */
  topBots: TopEntry[];
  /** Most accessed paths, sorted by request count descending. */
  topPaths: TopEntry[];
}

// ─── internal aggregation bucket ─────────────────────────────────────────────

interface Bucket {
  requests: number;
  revenue: number;
}

function sortedTop(map: Map<string, Bucket>, limit = 10): TopEntry[] {
  return [...map.entries()]
    .map(([name, b]) => ({ name, requests: b.requests, revenue: b.revenue }))
    .sort((a, b) => b.requests - a.requests || b.revenue - a.revenue)
    .slice(0, limit);
}

// ─── public API ───────────────────────────────────────────────────────────────

export class AnalyticsCollector {
  private readonly accessEvents: BotAccessEvent[] = [];
  private readonly paymentEvents: PaymentRequiredEvent[] = [];

  /** Aggregated per-bot counters, kept in sync on every track call. */
  private readonly botBuckets = new Map<string, Bucket>();
  /** Aggregated per-path counters, kept in sync on every track call. */
  private readonly pathBuckets = new Map<string, Bucket>();

  private totalRequests = 0;
  private paidRequests = 0;
  private revenue = 0;

  // ── private helpers ─────────────────────────────────────────────────────────

  private increment(
    map: Map<string, Bucket>,
    key: string,
    revenue: number,
  ): void {
    const bucket = map.get(key) ?? { requests: 0, revenue: 0 };
    bucket.requests += 1;
    bucket.revenue += revenue;
    map.set(key, bucket);
  }

  // ── public methods ──────────────────────────────────────────────────────────

  /**
   * Record a bot access attempt.
   *
   * @param botName - Bot identifier (e.g. `"OpenAI GPTBot"`).
   * @param path    - Request path (e.g. `"/blog/post-1"`).
   * @param allowed - Whether the request was allowed through.
   * @param price   - Amount charged for this request (omit if free / blocked).
   */
  trackAccess(
    botName: string,
    path: string,
    allowed: boolean,
    price?: number,
  ): void {
    const paid = price !== undefined && price > 0;
    const event: BotAccessEvent = {
      timestamp: Date.now(),
      botName,
      path,
      allowed,
      ...(price !== undefined ? { price } : {}),
    };

    this.accessEvents.push(event);
    this.totalRequests += 1;

    if (paid) {
      this.paidRequests += 1;
      this.revenue += price!;
    }

    const eventRevenue = paid ? price! : 0;
    this.increment(this.botBuckets, botName, eventRevenue);
    this.increment(this.pathBuckets, path, eventRevenue);
  }

  /**
   * Record that a payment-required response was returned to a bot.
   * This is a distinct event from `trackAccess` — it captures the moment
   * a 402 is issued, regardless of whether the bot later pays.
   */
  trackPaymentRequired(botName: string, path: string, price: number): void {
    this.paymentEvents.push({ timestamp: Date.now(), botName, path, price });
  }

  /**
   * Return a point-in-time snapshot of collected analytics.
   * Runs in O(B log B + P log P) where B = unique bots, P = unique paths.
   */
  getStats(): AnalyticsStats {
    return {
      totalRequests: this.totalRequests,
      paidRequests: this.paidRequests,
      revenue: this.revenue,
      topBots: sortedTop(this.botBuckets),
      topPaths: sortedTop(this.pathBuckets),
    };
  }

  /**
   * Return a copy of all recorded access events (useful for debugging /
   * exporting before a database layer is added).
   */
  getAccessEvents(): readonly BotAccessEvent[] {
    return [...this.accessEvents];
  }

  /**
   * Return a copy of all recorded payment-required events.
   */
  getPaymentEvents(): readonly PaymentRequiredEvent[] {
    return [...this.paymentEvents];
  }
}
