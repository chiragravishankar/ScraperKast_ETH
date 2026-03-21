/**
 * The category of bot activity.
 *
 * - `ai_training`  – crawlers that collect data to train AI models (e.g. GPTBot, CCBot)
 * - `ai_inference` – bots that fetch content to answer live user queries (e.g. ChatGPT-User, PerplexityBot)
 * - `search`       – traditional search-engine indexers (e.g. Googlebot, bingbot)
 * - `crawler`      – generic SEO / analytics crawlers (e.g. AhrefsBot, SemrushBot)
 * - `social`       – social-platform link-preview fetchers (e.g. facebookexternalhit)
 * - `unknown`      – matched a bot heuristic but no category was assigned
 */
export type BotType =
  | 'ai_training'
  | 'ai_inference'
  | 'search'
  | 'crawler'
  | 'social'
  | 'unknown';

export interface BotDetectionResult {
  isBot: boolean;
  /** Human-readable name of the matched bot, or `null` when no match. */
  botName: string | null;
  /**
   * How certain we are that this is the declared bot (0–1).
   * Bots with well-known, stable UA tokens get 1.0.
   * Bots whose tokens could partially overlap with other UAs get lower values.
   */
  confidence: number;
  /**
   * Category of the bot, or `null` when `isBot` is `false`.
   */
  type: BotType | null;
}

interface BotDefinition {
  name: string;
  patterns: RegExp[];
  confidence: number;
  type: BotType;
}

// ─── Bot definitions ──────────────────────────────────────────────────────────
// Order matters: the first matching definition wins.
// More specific patterns (longer tokens, stricter anchors) should come first.

const BOT_DEFINITIONS: readonly BotDefinition[] = [
  // ── OpenAI ──────────────────────────────────────────────────────────────────
  {
    name: 'OpenAI GPTBot',
    patterns: [/GPTBot/i],
    confidence: 1.0,
    type: 'ai_training',
  },
  {
    name: 'OpenAI ChatGPT-User',
    patterns: [/ChatGPT-User/i],
    confidence: 1.0,
    type: 'ai_inference',
  },
  // ── Anthropic ───────────────────────────────────────────────────────────────
  {
    name: 'Anthropic Claude-Web',
    patterns: [/Claude-Web/i],
    confidence: 1.0,
    type: 'ai_inference',
  },
  {
    name: 'Anthropic anthropic-ai',
    patterns: [/anthropic-ai/i],
    confidence: 1.0,
    type: 'ai_training',
  },
  {
    name: 'Anthropic claude-bot',
    patterns: [/claude-bot/i],
    confidence: 1.0,
    type: 'ai_inference',
  },
  // ── Google ───────────────────────────────────────────────────────────────────
  {
    name: 'Google Google-Extended',
    // Must come before Googlebot so the more-specific token wins.
    patterns: [/Google-Extended/i],
    confidence: 1.0,
    type: 'ai_training',
  },
  {
    name: 'Google Googlebot',
    patterns: [/Googlebot/i],
    confidence: 1.0,
    type: 'search',
  },
  // ── Bing ─────────────────────────────────────────────────────────────────────
  {
    name: 'Microsoft bingbot',
    patterns: [/bingbot/i],
    confidence: 1.0,
    type: 'search',
  },
  // ── Perplexity ───────────────────────────────────────────────────────────────
  {
    // More specific token first.
    name: 'Perplexity PerplexitySearchBot',
    patterns: [/PerplexitySearchBot/i],
    confidence: 1.0,
    type: 'ai_inference',
  },
  {
    name: 'Perplexity PerplexityBot',
    patterns: [/PerplexityBot/i],
    confidence: 1.0,
    type: 'ai_inference',
  },
  // ── You.com ───────────────────────────────────────────────────────────────────
  {
    name: 'You.com YouBot',
    patterns: [/YouBot/i],
    confidence: 1.0,
    type: 'ai_inference',
  },
  // ── Cohere ───────────────────────────────────────────────────────────────────
  {
    name: 'Cohere cohere-ai',
    patterns: [/cohere-ai/i],
    confidence: 1.0,
    type: 'ai_training',
  },
  // ── Common Crawl ─────────────────────────────────────────────────────────────
  {
    name: 'Common Crawl CCBot',
    patterns: [/CCBot/i],
    confidence: 1.0,
    type: 'ai_training',
  },
  // ── SEO crawlers ─────────────────────────────────────────────────────────────
  {
    name: 'Semrush SemrushBot',
    patterns: [/SemrushBot/i],
    confidence: 1.0,
    type: 'crawler',
  },
  {
    name: 'Ahrefs AhrefsBot',
    patterns: [/AhrefsBot/i],
    confidence: 1.0,
    type: 'crawler',
  },
  {
    name: 'Moz DotBot',
    patterns: [/DotBot/i],
    confidence: 1.0,
    type: 'crawler',
  },
  // ── Meta ─────────────────────────────────────────────────────────────────────
  {
    // More specific token first.
    name: 'Meta Meta-ExternalAgent',
    patterns: [/Meta-ExternalAgent/i],
    confidence: 1.0,
    type: 'ai_inference',
  },
  {
    name: 'Meta facebookexternalhit',
    patterns: [/facebookexternalhit/i],
    confidence: 0.9,
    type: 'social',
  },
];

// ─── Sentinel value ───────────────────────────────────────────────────────────

const NOT_A_BOT: BotDetectionResult = {
  isBot: false,
  botName: null,
  confidence: 0,
  type: null,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect whether a request comes from a known AI or web-crawling bot.
 *
 * @param userAgent - The value of the `User-Agent` request header.
 * @returns A {@link BotDetectionResult} describing the match.
 *
 * @example
 * detectBot('Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)')
 * // { isBot: true, botName: 'OpenAI GPTBot', confidence: 1, type: 'ai_training' }
 *
 * @example
 * detectBot('PerplexityBot/1.0')
 * // { isBot: true, botName: 'Perplexity PerplexityBot', confidence: 1, type: 'ai_inference' }
 */
export function detectBot(userAgent: string): BotDetectionResult {
  if (!userAgent || typeof userAgent !== 'string') {
    return NOT_A_BOT;
  }

  const trimmed = userAgent.trim();
  if (trimmed.length === 0) {
    return NOT_A_BOT;
  }

  for (const bot of BOT_DEFINITIONS) {
    for (const pattern of bot.patterns) {
      if (pattern.test(trimmed)) {
        return {
          isBot: true,
          botName: bot.name,
          confidence: bot.confidence,
          type: bot.type,
        };
      }
    }
  }

  return NOT_A_BOT;
}
