/**
 * Bot probability scoring from behavioral signals.
 *
 * Converts the raw {@link BehaviorSignals} from behavioral analysis into
 * a 0–100 score and then into a human-readable interpretation with a
 * confidence value (0–1) compatible with {@link BotDetectionResult}.
 */

import type { BehaviorSignals } from './behavioralAnalysis.js';

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Calculate a 0–100 bot probability score from behavioral signals.
 *
 * Higher score = more likely to be a bot.
 *
 * Point breakdown:
 * | Signal                        | Points  |
 * |-------------------------------|---------|
 * | RPS > 10                      | 30      |
 * | RPS 5–10                      | 20      |
 * | RPS 2–5                       | 10      |
 * | Sequential page access        | 25      |
 * | Missing browser headers       | 5 each (max 20) |
 * | No cookies                    | 10      |
 * | No referer                    | 5       |
 * | JavaScript not enabled        | 20      |
 * | Suspicious browser fingerprint| 15      |
 * | **Maximum**                   | **100** |
 */
export function calculateBotScore(signals: BehaviorSignals): number {
  let score = 0;

  // ── Request rate ──────────────────────────────────────────────────────────
  if (signals.requestsPerSecond > 10)      score += 30;
  else if (signals.requestsPerSecond > 5)  score += 20;
  else if (signals.requestsPerSecond > 2)  score += 10;

  // ── Sequential scraping pattern ───────────────────────────────────────────
  if (signals.sequentialPattern) score += 25;

  // ── Missing standard browser headers (5 pts each, max 20) ─────────────────
  score += Math.min(signals.missingHeaders.length * 5, 20);

  // ── Cookie / referer absence ──────────────────────────────────────────────
  if (!signals.hasCookies)  score += 10;
  if (!signals.hasReferer)  score += 5;

  // ── No JavaScript signals ─────────────────────────────────────────────────
  if (!signals.javascriptEnabled) score += 20;

  // ── Suspicious browser fingerprint ────────────────────────────────────────
  if (signals.suspiciousFingerprint) score += 15;

  return Math.min(score, 100);
}

// ─── Interpretation ───────────────────────────────────────────────────────────

export interface ScoreInterpretation {
  /** Whether to treat this request as a bot. */
  isBot: boolean;
  /**
   * Confidence that the decision is correct (0–1).
   * Matches the scale used by {@link BotDetectionResult.confidence}.
   */
  confidence: number;
  /** Human-readable label for logging / debugging. */
  label: string;
}

/**
 * Interpret a raw 0–100 bot score into a decision and confidence level.
 *
 * | Score  | Decision   | Confidence |
 * |--------|------------|------------|
 * | 80–100 | Bot        | 95 %       |
 * | 70–79  | Bot        | 85 %       |
 * | 50–69  | Bot        | 70 %       |
 * | 30–49  | Not a bot  | 60 %       |
 * | 0–29   | Not a bot  | 90 %       |
 */
export function interpretScore(score: number): ScoreInterpretation {
  if (score >= 80) return { isBot: true,  confidence: 0.95, label: 'Bot (95% confidence)'    };
  if (score >= 70) return { isBot: true,  confidence: 0.85, label: 'Bot (85% confidence)'    };
  if (score >= 50) return { isBot: true,  confidence: 0.70, label: 'Bot (70% confidence)'    };
  if (score >= 30) return { isBot: false, confidence: 0.60, label: 'Not bot (60% confidence)' };
  return             { isBot: false, confidence: 0.90, label: 'Not bot (90% confidence)' };
}
