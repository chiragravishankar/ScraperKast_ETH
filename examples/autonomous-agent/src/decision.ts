import { log } from './logger.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PaymentChallenge {
  amount:      number;  // µUSDC
  currency:    string;
  wallet:      string;  // Solana address
  description: string;
}

export interface Decision {
  proceed:          boolean;
  reasoning:        string;
  relevanceLabel:   'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
  relevanceScore:   number; // 0–1
  affordability:    'AFFORDABLE' | 'EXPENSIVE' | 'UNAFFORDABLE';
}

// ── Relevance scoring ─────────────────────────────────────────────────────────

/**
 * Simple keyword-overlap relevance between content description and agent goal.
 * In production this would call an LLM for semantic scoring.
 */
function scoreRelevance(description: string, goal: string): number {
  const stop = new Set(['and', 'the', 'a', 'an', 'of', 'in', 'for', 'to', 'with', 'about']);
  const normalize = (s: string) =>
    s.toLowerCase()
     .replace(/[^a-z0-9 ]/g, '')
     .split(/\s+/)
     .filter(w => w.length > 2 && !stop.has(w));

  const goalWords = normalize(goal);
  const descWords = new Set(normalize(description));
  if (goalWords.length === 0) return 0;

  const hits = goalWords.filter(w => descWords.has(w)).length;
  return hits / goalWords.length;
}

function relevanceLabel(score: number): 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' {
  if (score >= 0.35) return 'HIGH';
  if (score >= 0.15) return 'MEDIUM';
  if (score > 0)     return 'LOW';
  return 'NONE';
}

function affordabilityLabel(
  balance: number,
  amount: number,
  maxPrice: number
): 'AFFORDABLE' | 'EXPENSIVE' | 'UNAFFORDABLE' {
  if (balance < amount)     return 'UNAFFORDABLE';
  if (amount > maxPrice)    return 'EXPENSIVE';
  return 'AFFORDABLE';
}

// ── Decision engine ───────────────────────────────────────────────────────────

export function evaluate(
  balance: number,
  challenge: PaymentChallenge,
  goal: string,
  maxPrice: number
): Decision {
  const relScore  = scoreRelevance(challenge.description, goal);
  const relLabel  = relevanceLabel(relScore);
  const afford    = affordabilityLabel(balance, challenge.amount, maxPrice);

  const proceed =
    afford === 'AFFORDABLE' &&
    (relLabel === 'HIGH' || relLabel === 'MEDIUM' || challenge.amount <= 5000);

  const reasoning = [
    `Goal relevance:   ${relLabel} (${(relScore * 100).toFixed(0)}% keyword overlap)`,
    `Balance:          ${balance.toLocaleString()} µUSDC`,
    `Content cost:     ${challenge.amount.toLocaleString()} µUSDC ($${(challenge.amount / 1_000_000).toFixed(6)})`,
    `Affordability:    ${afford}`,
    `Decision:         ${proceed ? '✅ PROCEED WITH PAYMENT' : '❌ SKIP'}`,
  ].join('\n');

  return { proceed, reasoning, relevanceLabel: relLabel, relevanceScore: relScore, affordability: afford };
}

// ── Logging helper ────────────────────────────────────────────────────────────

export function logDecision(
  balance: number,
  challenge: PaymentChallenge,
  goal: string,
  maxPrice: number
): Decision {
  const d = evaluate(balance, challenge, goal, maxPrice);

  log.section('AUTONOMOUS DECISION ENGINE');
  log.detail('Agent goal:',       goal);
  log.detail('Content:',          challenge.description);
  log.detail('Price:',            `${challenge.amount.toLocaleString()} µUSDC ($${(challenge.amount / 1_000_000).toFixed(4)})`);
  log.detail('Balance:',          `${balance.toLocaleString()} µUSDC`);
  log.detail('Relevance:',        `${d.relevanceLabel} (${(d.relevanceScore * 100).toFixed(0)}%)`);
  log.detail('Affordability:',    d.affordability);
  console.log('');
  log.decision(d.proceed ? '✅ PROCEED WITH PAYMENT' : '❌ SKIPPING — not worth the cost');

  return d;
}
