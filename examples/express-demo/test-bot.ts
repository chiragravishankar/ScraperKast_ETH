#!/usr/bin/env -S npx tsx
/**
 * ScraperKast test client — simulates AI bot HTTP requests.
 *
 * Usage:
 *   tsx test-bot.ts --bot GPTBot --path /blog/intro-to-llms
 *   tsx test-bot.ts --bot Claude-Web --path /docs/api/authentication --token eyJhbGc...
 *   tsx test-bot.ts --help
 */

// ─── ANSI colour helpers ──────────────────────────────────────────────────────

const ESC = '\x1b';
const c = {
  reset:   `${ESC}[0m`,
  bold:    `${ESC}[1m`,
  dim:     `${ESC}[2m`,
  green:   `${ESC}[32m`,
  yellow:  `${ESC}[33m`,
  red:     `${ESC}[31m`,
  blue:    `${ESC}[34m`,
  cyan:    `${ESC}[36m`,
  magenta: `${ESC}[35m`,
  white:   `${ESC}[97m`,
} as const;

const paint  = (col: string, t: string) => `${col}${t}${c.reset}`;
const bold   = (t: string) => paint(c.bold, t);
const dim    = (t: string) => paint(c.dim, t);

// ─── Known bots ───────────────────────────────────────────────────────────────

interface BotEntry {
  /** Token sent in the User-Agent header */
  ua: string;
  /** Human label shown in --help  */
  label: string;
  /** Category shown in --help */
  type: 'ai_training' | 'ai_inference' | 'search' | 'crawler' | 'social';
}

const BOTS: Record<string, BotEntry> = {
  // ── OpenAI ────────────────────────────────────────────────────
  GPTBot:          { ua: 'GPTBot/1.0 (+https://openai.com/gptbot)',                    label: 'OpenAI GPTBot',                  type: 'ai_training'  },
  'ChatGPT-User':  { ua: 'ChatGPT-User/1.0 (+https://openai.com/bot)',                 label: 'OpenAI ChatGPT-User',            type: 'ai_inference' },

  // ── Anthropic ─────────────────────────────────────────────────
  'Claude-Web':    { ua: 'Claude-Web/1.0 (+https://www.anthropic.com)',                label: 'Anthropic Claude-Web',           type: 'ai_inference' },
  'anthropic-ai':  { ua: 'anthropic-ai/1.0 (+https://www.anthropic.com)',              label: 'Anthropic anthropic-ai',         type: 'ai_training'  },
  'claude-bot':    { ua: 'claude-bot/1.0 (+https://www.anthropic.com)',                label: 'Anthropic claude-bot',           type: 'ai_inference' },

  // ── Google ────────────────────────────────────────────────────
  Googlebot:       { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://google.com/bot.html)', label: 'Google Googlebot',     type: 'search'       },
  'Google-Extended': { ua: 'Google-Extended/1.0 (+https://developers.google.com/search)', label: 'Google Google-Extended',    type: 'ai_training'  },

  // ── Microsoft ─────────────────────────────────────────────────
  bingbot:         { ua: 'Mozilla/5.0 (compatible; bingbot/2.0; +http://bing.com/bingbot.htm)', label: 'Microsoft bingbot',     type: 'search'       },

  // ── Perplexity ────────────────────────────────────────────────
  PerplexityBot:   { ua: 'PerplexityBot/1.0 (+https://perplexity.ai/bot)',             label: 'Perplexity PerplexityBot',       type: 'ai_inference' },
  PerplexitySearchBot: { ua: 'PerplexitySearchBot/1.0 (+https://perplexity.ai/bot)',   label: 'Perplexity PerplexitySearchBot', type: 'ai_inference' },

  // ── You.com ───────────────────────────────────────────────────
  YouBot:          { ua: 'YouBot/1.0 (+https://you.com/bot)',                          label: 'You.com YouBot',                 type: 'ai_inference' },

  // ── Cohere ────────────────────────────────────────────────────
  'cohere-ai':     { ua: 'cohere-ai/1.0 (+https://cohere.com)',                        label: 'Cohere cohere-ai',               type: 'ai_training'  },

  // ── Meta ──────────────────────────────────────────────────────
  'Meta-ExternalAgent':   { ua: 'Meta-ExternalAgent/1.0 (+https://meta.com/bot)',      label: 'Meta Meta-ExternalAgent',        type: 'ai_inference' },
  facebookexternalhit:    { ua: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', label: 'Meta facebookexternalhit', type: 'social' },

  // ── Crawlers ──────────────────────────────────────────────────
  CCBot:           { ua: 'CCBot/2.0 (https://commoncrawl.org/faq/)',                   label: 'Common Crawl CCBot',             type: 'ai_training'  },
  SemrushBot:      { ua: 'SemrushBot/7.0 (+http://www.semrush.com/bot.html)',          label: 'Semrush SemrushBot',             type: 'crawler'      },
  AhrefsBot:       { ua: 'AhrefsBot/7.0 (+http://ahrefs.com/robot/)',                 label: 'Ahrefs AhrefsBot',               type: 'crawler'      },
  DotBot:          { ua: 'DotBot/1.2 (+https://opensiteexplorer.org/dotbot)',          label: 'Moz DotBot',                     type: 'crawler'      },
};

// Colour a bot type label
function typeColour(type: BotEntry['type']): string {
  switch (type) {
    case 'ai_training':  return paint(c.magenta, type);
    case 'ai_inference': return paint(c.cyan,    type);
    case 'search':       return paint(c.blue,    type);
    case 'crawler':      return paint(c.yellow,  type);
    case 'social':       return paint(c.green,   type);
  }
}

// ─── Help ─────────────────────────────────────────────────────────────────────

function printHelp(): void {
  const BOT_COL  = 22;
  const LABEL_COL = 36;

  console.log(`
${bold('ScraperKast Test Bot')} ${dim('— simulate AI crawler requests against the demo server')}

${bold('USAGE')}
  tsx test-bot.ts ${paint(c.cyan, '--bot')} ${paint(c.yellow, '<token>')} ${paint(c.cyan, '--path')} ${paint(c.yellow, '<path>')} [${paint(c.cyan, '--token')} ${paint(c.yellow, '<jwt>')}] [${paint(c.cyan, '--base-url')} ${paint(c.yellow, '<url>')}]
  tsx test-bot.ts ${paint(c.cyan, '--help')}

${bold('OPTIONS')}
  ${paint(c.cyan, '--bot')}       ${dim('(required)')}  Bot token to send as User-Agent (see table below)
  ${paint(c.cyan, '--path')}      ${dim('(required)')}  Request path, e.g. /blog/intro-to-llms
  ${paint(c.cyan, '--token')}     ${dim('(optional)')}  JWT to send as Authorization: Bearer <token>
  ${paint(c.cyan, '--base-url')}  ${dim('(optional)')}  Base URL  ${dim('[default: http://localhost:3000]')}
  ${paint(c.cyan, '--help')}                 Print this message

${bold('EXAMPLES')}
  ${dim('# Unauthenticated bot → 402 Payment Required')}
  tsx test-bot.ts --bot GPTBot --path /blog/intro-to-llms

  ${dim('# Bot with a JWT → 200 OK')}
  tsx test-bot.ts --bot Claude-Web --path /docs/api/authentication --token eyJhbGc...

  ${dim('# Bot hitting an unpriced route → 403 Forbidden')}
  tsx test-bot.ts --bot PerplexityBot --path /

  ${dim('# Generate a JWT first (run from the repo root)')}
  node --input-type=module <<'EOF'
  import { AuthService } from '@scraperkast/core';
  const s = new AuthService('dev-secret-change-in-production');
  console.log(s.generateToken('my-bot', 50, []));
  EOF

  ${dim('# Test against a remote server')}
  tsx test-bot.ts --bot GPTBot --path /blog/intro-to-llms --base-url https://mysite.com

${bold('AVAILABLE BOTS')}
  ${'Token'.padEnd(BOT_COL)}${'Detected as'.padEnd(LABEL_COL)}Type`);

  // Group by type for readability
  const order: BotEntry['type'][] = ['ai_training', 'ai_inference', 'search', 'crawler', 'social'];
  const grouped = new Map<BotEntry['type'][], string[]>(order.map(t => [t as unknown as BotEntry['type'][], []]));

  // Flat sorted list, grouped by type
  const byType = new Map<string, string[]>();
  for (const t of order) byType.set(t, []);
  for (const [token, entry] of Object.entries(BOTS)) {
    byType.get(entry.type)!.push(token);
  }

  for (const type of order) {
    const tokens = byType.get(type)!;
    if (tokens.length === 0) continue;
    console.log(`  ${dim('·'.repeat(BOT_COL + LABEL_COL + 16))}`);
    for (const token of tokens) {
      const entry = BOTS[token]!;
      const tok   = paint(c.yellow, token).padEnd(token.length < BOT_COL ? BOT_COL + (paint(c.yellow, '').length) : BOT_COL);
      const lbl   = dim(entry.label).padEnd(entry.label.length < LABEL_COL ? LABEL_COL + (dim('').length) : LABEL_COL);
      console.log(`  ${tok}${lbl}${typeColour(entry.type)}`);
    }
  }

  console.log('');
}

// ─── Arg parsing ──────────────────────────────────────────────────────────────

interface Args {
  bot:     string;
  path:    string;
  token:   string | null;
  baseUrl: string;
}

function parseArgs(argv: string[]): Args | null {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const get = (flag: string): string | null => {
    const i = argv.indexOf(flag);
    return i !== -1 && argv[i + 1] !== undefined ? (argv[i + 1] as string) : null;
  };

  const bot     = get('--bot');
  const path    = get('--path');
  const token   = get('--token');
  const baseUrl = get('--base-url') ?? 'http://localhost:3000';

  if (bot === null || path === null) {
    console.error(`${paint(c.red, 'Error:')} --bot and --path are required.\n`);
    console.error(`Run ${paint(c.cyan, 'tsx test-bot.ts --help')} for usage.\n`);
    process.exit(1);
  }

  return { bot, path, token, baseUrl };
}

// ─── Status colour ────────────────────────────────────────────────────────────

function statusLine(status: number): string {
  if (status === 200) return paint(c.bold + c.green,  `${status} OK`);
  if (status === 402) return paint(c.bold + c.yellow, `${status} Payment Required`);
  if (status === 403) return paint(c.bold + c.red,    `${status} Forbidden`);
  if (status === 404) return paint(c.bold + c.red,    `${status} Not Found`);
  return paint(c.bold + c.blue, `${status}`);
}

// Pretty-print a JSON value with syntax highlighting
function prettyJson(val: unknown, indent = 0): string {
  const pad = ' '.repeat(indent);
  const pad2 = ' '.repeat(indent + 2);

  if (val === null)             return paint(c.yellow, 'null');
  if (typeof val === 'boolean') return paint(c.yellow, String(val));
  if (typeof val === 'number')  return paint(c.cyan,   String(val));
  if (typeof val === 'string')  return paint(c.green,  JSON.stringify(val));

  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    const items = val.map(v => `${pad2}${prettyJson(v, indent + 2)}`).join(',\n');
    return `[\n${items}\n${pad}]`;
  }

  if (typeof val === 'object') {
    const entries = Object.entries(val as Record<string, unknown>);
    if (entries.length === 0) return '{}';
    const lines = entries.map(([k, v]) => {
      const key = paint(c.blue, JSON.stringify(k));
      return `${pad2}${key}: ${prettyJson(v, indent + 2)}`;
    }).join(',\n');
    return `{\n${lines}\n${pad}}`;
  }

  return String(val);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args === null) return; // unreachable; parseArgs exits on error

  const { bot, path, token, baseUrl } = args;

  // Resolve User-Agent: accept either the short token key or the full UA string
  const knownEntry = BOTS[bot];
  const userAgent  = knownEntry?.ua ?? bot;     // fall back to the raw value so custom UAs work
  const botLabel   = knownEntry?.label ?? bot;

  const url     = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept':     'application/json',
  };
  if (token !== null) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // ── Print request summary ────────────────────────────────────────────────
  const divider = dim('─'.repeat(56));
  console.log(`\n${divider}`);
  console.log(`  ${bold('Bot')}      ${paint(c.yellow, botLabel)}`);
  console.log(`  ${bold('UA')}       ${dim(userAgent)}`);
  console.log(`  ${bold('URL')}      ${paint(c.cyan, url)}`);
  console.log(`  ${bold('Token')}    ${token !== null ? paint(c.green, `Bearer ${token.slice(0, 20)}…`) : dim('(none)')}`);
  console.log(divider);

  // ── Make request ─────────────────────────────────────────────────────────
  let response: Response;
  try {
    response = await fetch(url, { headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n${paint(c.red, 'Request failed:')} ${msg}`);
    console.error(dim(`  Is the server running? Start it with: ${paint(c.cyan, 'npm run dev')}\n`));
    process.exit(1);
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  const rawBody = await response.text();
  let parsed: unknown = null;
  let isJson = false;
  try {
    parsed = JSON.parse(rawBody);
    isJson = true;
  } catch {
    // not JSON — print as plain text
  }

  // ── Print response ───────────────────────────────────────────────────────
  console.log(`\n  ${bold('Status')}   ${statusLine(response.status)}\n`);

  if (isJson && parsed !== null) {
    // Extra callout for well-known response shapes
    if (response.status === 402 && typeof parsed === 'object' && parsed !== null) {
      const body = parsed as Record<string, unknown>;
      const pricing = body['pricing'] as Record<string, unknown> | undefined;
      if (pricing) {
        const cents = Number(pricing['pricePerPage']);
        const usd   = (cents / 100_000).toFixed(5); // pricePerPage is micro-dollars (100 = $0.001)
        console.log(`  ${paint(c.yellow, '💰')} ${bold('Price:')} $${usd} per page  ${dim(`(${cents} micro-USD)`)}`);
      }
      if (typeof body['paymentUrl'] === 'string') {
        console.log(`  ${paint(c.yellow, '🔗')} ${bold('Pay:')}   ${paint(c.cyan, body['paymentUrl'])}`);
      }
      console.log('');
    }

    if (response.status === 200) {
      console.log(`  ${paint(c.green, '✅')} ${bold('Access granted')} — middleware passed the request through.\n`);
    }

    if (response.status === 403) {
      console.log(`  ${paint(c.red, '🚫')} ${bold('Blocked')} — no pricing rule covers this bot + path combination.\n`);
    }

    console.log(prettyJson(parsed, 2));
  } else {
    console.log(rawBody);
  }

  console.log(`\n${divider}\n`);
}

main().catch(err => {
  console.error(paint(c.red, 'Unexpected error:'), err);
  process.exit(1);
});
