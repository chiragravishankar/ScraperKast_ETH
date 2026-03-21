/**
 * ScraperKast — Express Demo Server
 *
 * Demonstrates how to protect content routes with @scraperkast/middleware-express.
 * Run with:  npm run dev
 */

import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { scraperKast } from '@scraperkast/middleware-express';
import { detectBot } from '@scraperkast/core';

// ─── ANSI colour helpers ──────────────────────────────────────────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  blue:   '\x1b[34m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  magenta:'\x1b[35m',
} as const;

const paint = (colour: string, text: string) => `${colour}${text}${c.reset}`;

// ─── Configuration ────────────────────────────────────────────────────────────

const PORT       = Number(process.env['PORT'] ?? 3000);
const JWT_SECRET = process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production';

if (JWT_SECRET === 'dev-secret-change-in-production') {
  console.warn(
    paint(c.yellow, '⚠  Using default JWT_SECRET. Set JWT_SECRET in .env before deploying.'),
  );
}

// ─── App setup ────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// ─── ScraperKast middleware ───────────────────────────────────────────────────
//
// Pricing rules (pricePerPage is in micro-dollars; 100 = $0.001):
//   /blog/*      → $0.001  summarization licence  (affordable for AI summaries)
//   /docs/api/*  → $0.005  full_display licence   (API docs cost more)
//   /premium/*   → $0.010  full_display licence   (premium, highest rate)
//
// Routes NOT covered by any rule (/  and  /free/*) return 403 to bots
// while passing human traffic straight through — no rule, no access.
//

app.use(
  scraperKast({
    jwtSecret: JWT_SECRET,
    enableAnalytics: true,

    rules: [
      {
        id:           'blog',
        path:         '/blog/*',
        pricePerPage: 100,           // $0.001 per page
        licenseType:  'summarization',
      },
      {
        id:           'api-docs',
        path:         '/docs/api/*',
        pricePerPage: 500,           // $0.005 per page
        licenseType:  'full_display',
      },
      {
        id:           'premium',
        path:         '/premium/*',
        pricePerPage: 1000,          // $0.01 per page
        licenseType:  'full_display',
      },
    ],

    onAuthorized(req: Request, botName: string) {
      const tag = paint(c.bold + c.green, '✅ AUTHORIZED');
      console.log(`${tag}  ${paint(c.green, botName)}  →  ${paint(c.dim, req.path)}`);
    },

    onPaymentRequired(req: Request) {
      const ua     = req.headers['user-agent'] ?? '';
      const result = detectBot(ua);
      const name   = result.botName ?? ua;
      const tag    = paint(c.bold + c.red, '💰 PAYMENT REQUIRED');
      console.log(`${tag}  ${paint(c.red, name)}  →  ${paint(c.dim, req.path)}`);
    },
  }),
);

// ─── Middleware: log human traffic ────────────────────────────────────────────

app.use((req: Request, _res: Response, next) => {
  const ua     = req.headers['user-agent'] ?? '';
  const result = detectBot(ua);
  if (!result.isBot) {
    const tag = paint(c.bold + c.blue, '👤 HUMAN');
    console.log(`${tag}  ${paint(c.blue, req.method)}  ${paint(c.dim, req.path)}`);
  }
  next();
});

// ─── Route data ──────────────────────────────────────────────────────────────

const BLOG_POSTS: Record<string, {
  title: string; author: string; date: string; readingTime: string; content: string;
}> = {
  'intro-to-llms': {
    title:       'Introduction to Large Language Models',
    author:      'Ada Lovelace',
    date:        '2024-11-01',
    readingTime: '8 min',
    content: `
Large Language Models (LLMs) are neural networks trained on massive text corpora
to predict the next token in a sequence. Architecturally they are decoder-only
Transformers — GPT-style — that use self-attention to relate every token in the
context window to every other token before generating the next one.

Training happens in two phases. First, unsupervised pre-training on hundreds of
billions of tokens teaches the model grammar, facts, reasoning patterns, and
world knowledge. Second, instruction-tuning with Reinforcement Learning from
Human Feedback (RLHF) aligns the model with human preferences, making it
helpful, harmless, and honest.

Key concepts every practitioner should understand:
  • Tokenisation — text is split into sub-word pieces; ~4 characters per token on average.
  • Context window — the maximum number of tokens the model can attend to at once.
  • Temperature — controls output randomness; 0 = deterministic, 1 = default, >1 = creative.
  • Hallucination — models sometimes generate plausible-sounding but incorrect facts.
  • RAG — Retrieval-Augmented Generation grounds model outputs in a live knowledge base.

In 2025 the frontier sits at 1–2 trillion parameter models with 1M+ token context
windows, multi-modal capabilities (text + image + audio + video), and tool-calling
that lets models browse the web, execute code, and call external APIs.
    `.trim(),
  },

  'transformer-architecture': {
    title:       'The Transformer Architecture Explained',
    author:      'Alan Turing',
    date:        '2024-12-15',
    readingTime: '12 min',
    content: `
The Transformer, introduced in "Attention Is All You Need" (Vaswani et al., 2017),
replaced recurrent networks with a fully attention-based architecture that trains
orders of magnitude faster on modern hardware.

Core components:
  1. Embedding layer — converts each token ID into a dense vector (d_model dims).
  2. Positional encoding — injects token position information via sinusoids or learned
     embeddings, since attention is permutation-invariant by design.
  3. Multi-Head Self-Attention (MHSA) — each head learns different relational patterns;
     outputs are concatenated and projected back to d_model.
  4. Feed-Forward Network (FFN) — two linear layers with a GELU/SwiGLU activation,
     applied independently to each position.
  5. Layer Normalisation + Residual connections — stabilise training and enable very
     deep networks (100+ layers in modern models).
  6. Causal (masked) attention — each position can only attend to earlier positions,
     enforcing autoregressive generation.

Modern innovations beyond the original paper:
  • Flash Attention — IO-aware exact attention that is 2–4× faster and uses O(n) memory.
  • Grouped Query Attention (GQA) — fewer KV heads reduces memory bandwidth at inference.
  • Rotary Position Embeddings (RoPE) — relative positional encoding that generalises
    better to longer sequences than learned absolute positions.
  • Mixture of Experts (MoE) — only a fraction of parameters are activated per token,
    scaling parameter count without proportional compute cost.
    `.trim(),
  },

  'monetising-ai-content': {
    title:       'Monetising Your Content in the Age of AI Scrapers',
    author:      'Grace Hopper',
    date:        '2025-02-28',
    readingTime: '6 min',
    content: `
AI companies are training models on web content at a scale that makes traditional
robots.txt agreements unenforceable. A new class of tools — collectively called
AI Content Monetisation platforms — gives website owners a way to charge AI crawlers
directly rather than simply blocking them.

The general model works like this:

  1. Deploy middleware that detects known AI bots by User-Agent string.
  2. Return HTTP 402 Payment Required with a machine-readable pricing payload.
  3. Bot operators purchase access tokens at the listed price.
  4. Subsequent requests carry a signed JWT; middleware admits them transparently.

This demo (ScraperKast) is the open-source reference implementation of that pattern.
It ships with bot detection, a pricing engine, JWT auth, and analytics out of the box.

Market context:
  • The New York Times sued OpenAI in December 2023 for wholesale reproduction of articles.
  • Condé Nast, AP, Axel Springer, and others have signed commercial licensing deals with AI labs.
  • The EU AI Act (effective August 2026) requires AI providers to disclose training data sources.
  • Platforms like TollBit and ScraperKast let individual publishers participate without
    negotiating enterprise contracts.

Pricing guidance for independent publishers:
  • Blog / editorial content  →  $0.001–$0.005 per page  (summarisation licence)
  • Technical documentation   →  $0.005–$0.02  per page  (full display licence)
  • Paywalled / premium data  →  $0.01–$0.10   per page  (full display + exclusivity)
    `.trim(),
  },
};

const API_DOCS: Record<string, {
  title: string; version: string; content: string; codeExamples: Array<{ language: string; code: string }>;
}> = {
  authentication: {
    title:   'Authentication',
    version: 'v1',
    content: `
ScraperKast uses signed JWTs (JSON Web Tokens) to authenticate bot operators.
Every token carries the bot's identity, a credit balance, and an expiry timestamp.
Tokens are signed with HS256 using a secret shared between the payment server and
your ScraperKast middleware deployment.

Token lifecycle:
  1. Bot operator visits the paymentUrl from a 402 response.
  2. They pay via Stripe; the ScraperKast payment server issues a signed JWT.
  3. The bot sends the JWT on each subsequent request as a Bearer token.
  4. Middleware verifies the signature, checks credits > 0, and admits the request.
  5. Credits decrement server-side; when they reach 0 the bot must purchase more.

Token payload shape:
  {
    "botId":          "openai-gptbot",
    "credits":        500,
    "allowedDomains": ["example.com"],
    "exp":            1714000000
  }

Security considerations:
  • Never expose your JWT_SECRET. Rotate it immediately if compromised.
  • Tokens are short-lived (1 hour default) to limit blast radius of theft.
  • allowedDomains restricts which sites the token is valid for (empty = any site).
    `.trim(),
    codeExamples: [
      {
        language: 'bash',
        code: `# Send a request as an authenticated bot
curl https://yourdomain.com/blog/my-post \\
  -H "User-Agent: GPTBot/1.0" \\
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9..."`,
      },
      {
        language: 'typescript',
        code: `import { AuthService } from '@scraperkast/core';

const auth  = new AuthService(process.env.JWT_SECRET!);
const token = auth.generateToken('my-bot', 100, ['example.com']);

// token is a signed JWT valid for 1 hour with 100 credits
console.log(token);`,
      },
    ],
  },

  endpoints: {
    title:   'API Endpoints',
    version: 'v1',
    content: `
ScraperKast does not expose its own HTTP API — it IS middleware.
The "endpoints" you interact with are the routes of the host application.
ScraperKast intercepts those routes before your handlers run.

Request flow:
  POST / GET / HEAD  →  scraperKast()  →  your route handler

HTTP status codes returned by ScraperKast:
  200  Request passed through (human, or bot with valid JWT)
  402  Payment Required — bot detected, no valid token, pricing rule matched
  403  Forbidden — bot detected, no valid token, no pricing rule for this path
  500  Unexpected error forwarded to Express error handler

402 response body:
  {
    "error":    "Payment Required",
    "bot":      "OpenAI GPTBot",
    "pricing":  { "pricePerPage": 100, "currency": "USD" },
    "paymentUrl": "https://api.scraperkast.com/pay?bot=OpenAI+GPTBot&path=/blog/post",
    "documentation": "https://docs.scraperkast.com"
  }
    `.trim(),
    codeExamples: [
      {
        language: 'typescript',
        code: `import express from 'express';
import { scraperKast } from '@scraperkast/middleware-express';

const app = express();

// Mount BEFORE your route handlers
app.use(scraperKast({
  jwtSecret: process.env.JWT_SECRET!,
  rules: [
    { id: 'blog', path: '/blog/*', pricePerPage: 100, licenseType: 'summarization' },
  ],
}));

app.get('/blog/:slug', (req, res) => {
  res.json({ title: 'My Post', slug: req.params.slug });
});`,
      },
    ],
  },

  errors: {
    title:   'Error Reference',
    version: 'v1',
    content: `
ScraperKast surfaces errors as JSON responses with predictable shapes.
All errors include an "error" field with a short machine-readable string.

402 Payment Required
  Returned when:  A known bot makes a request, has no valid JWT token, and a
                  pricing rule exists for the requested path.
  Action:         Visit paymentUrl to purchase credits and receive a JWT.

403 Forbidden
  Returned when:  A known bot makes a request and no pricing rule covers the
                  bot+path combination. The site owner has not opted in to
                  monetising this path — access is simply denied.
  Action:         Contact the site owner or consult documentation.

Invalid / expired token (treated as no token)
  When a bot presents an expired or invalid JWT the middleware treats it as if
  no token was provided and falls through to the pricing check. This avoids
  leaking whether a token was ever valid.

Zero-credit token (treated as no token)
  A valid JWT with credits == 0 is also treated as no token.
  The bot must purchase a top-up before making further requests.
    `.trim(),
    codeExamples: [
      {
        language: 'bash',
        code: `# 402 example — bot with no token hits a priced route
curl -i https://yourdomain.com/blog/my-post \\
  -H "User-Agent: GPTBot/1.0"

# HTTP/1.1 402 Payment Required
# { "error": "Payment Required", "paymentUrl": "...", ... }

# 403 example — bot hits an unpriced route
curl -i https://yourdomain.com/ \\
  -H "User-Agent: GPTBot/1.0"

# HTTP/1.1 403 Forbidden
# { "error": "Forbidden", "message": "Bot ... is not permitted to access /" }`,
      },
    ],
  },
};

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET / — landing page (no pricing rule → bots get 403, humans get 200)
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message:     'Welcome to the ScraperKast Demo',
    description: 'An open-source AI content monetisation platform. Protect your content, charge AI bots, let humans through — all with a single middleware.',
    version:     '0.1.0',

    endpoints: [
      {
        path:     '/blog/:slug',
        pricing:  '$0.001 / page',
        licence:  'summarization',
        example:  '/blog/intro-to-llms',
        availableSlugs: Object.keys(BLOG_POSTS),
      },
      {
        path:     '/docs/api/:section',
        pricing:  '$0.005 / page',
        licence:  'full_display',
        example:  '/docs/api/authentication',
        availableSections: Object.keys(API_DOCS),
      },
      {
        path:     '/premium/data',
        pricing:  '$0.01 / page',
        licence:  'full_display',
        example:  '/premium/data',
      },
      {
        path:     '/free/about',
        pricing:  'free (no pricing rule)',
        licence:  'n/a',
        note:     'Humans pass through freely. Bots are blocked (403) because there is no pricing rule — the site owner has not opted in to monetising this path.',
        example:  '/free/about',
      },
      {
        path:     '/',
        pricing:  'free (no pricing rule)',
        note:     'This page. Bots receive 403 — you are seeing this because you are human.',
      },
    ],

    howToTest: {
      asHuman: {
        description: 'No User-Agent spoofing — middleware passes you straight through.',
        command:     'curl http://localhost:3000/blog/intro-to-llms',
      },
      asBotNoToken: {
        description: 'Bot User-Agent, no JWT → 402 Payment Required (or 403 if path has no rule).',
        command:     'curl -H "User-Agent: GPTBot/1.0" http://localhost:3000/blog/intro-to-llms',
      },
      generateToken: {
        description: 'Generate a short-lived JWT using AuthService from @scraperkast/core.',
        command: `node -e "
  import('@scraperkast/core').then(({ AuthService }) => {
    const svc   = new AuthService(process.env.JWT_SECRET ?? 'dev-secret-change-in-production');
    const token = svc.generateToken('demo-bot', 50, []);
    console.log(token);
  });
"`,
      },
      asBotWithToken: {
        description: 'Bot User-Agent + valid JWT → 200, middleware lets the request through.',
        command:     'curl -H "User-Agent: GPTBot/1.0" -H "Authorization: Bearer <token>" http://localhost:3000/blog/intro-to-llms',
      },
    },

    links: {
      repository:    'https://github.com/your-org/scraperkast',
      documentation: 'https://docs.scraperkast.com',
      middleware:    'https://www.npmjs.com/package/@scraperkast/middleware-express',
    },
  });
});

// GET /blog/:slug
app.get('/blog/:slug', (req: Request, res: Response) => {
  const { slug } = req.params;
  const post = BLOG_POSTS[slug];

  if (post === undefined) {
    res.status(404).json({
      error:           'Not Found',
      message:         `Blog post "${slug}" does not exist.`,
      availableSlugs:  Object.keys(BLOG_POSTS),
    });
    return;
  }

  res.json({
    slug,
    title:       post.title,
    author:      post.author,
    date:        post.date,
    readingTime: post.readingTime,
    content:     post.content,
    _meta: {
      licence:      'summarization',
      pricePerPage: '$0.001',
      note:         'This content is protected by ScraperKast. AI bots need a valid JWT to access it.',
    },
  });
});

// GET /docs/api/:section
app.get('/docs/api/:section', (req: Request, res: Response) => {
  const { section } = req.params;
  const doc = API_DOCS[section];

  if (doc === undefined) {
    res.status(404).json({
      error:              'Not Found',
      message:            `Documentation section "${section}" does not exist.`,
      availableSections:  Object.keys(API_DOCS),
    });
    return;
  }

  res.json({
    section,
    title:        doc.title,
    version:      doc.version,
    content:      doc.content,
    codeExamples: doc.codeExamples,
    _meta: {
      licence:      'full_display',
      pricePerPage: '$0.005',
      note:         'API documentation carries a higher licence fee due to its technical specificity.',
    },
  });
});

// GET /premium/data
app.get('/premium/data', (_req: Request, res: Response) => {
  res.json({
    title:       'Premium AI Market Intelligence Report — Q1 2025',
    publishedAt: '2025-03-01T00:00:00Z',
    sections: [
      {
        heading: 'Foundation Model Pricing Trends',
        body:    'GPT-4o input tokens dropped 75% YoY to $2.50/M as competition intensified. Claude 3.5 Sonnet and Gemini 1.5 Pro followed within weeks, compressing margins across the board. Inference-as-a-service gross margins settled in the 60–70% range for frontier labs.',
      },
      {
        heading: 'Content Licensing Market Size',
        body:    'Estimated $600M in AI content licensing deals closed in 2024. The New York Times deal with Microsoft is the largest disclosed at ~$100M over 5 years. Publishers with daily content freshness (news, finance, weather) command 5–10× premiums over static content sites.',
      },
      {
        heading: 'Bot Traffic Share by Sector',
        body:    'Technology blogs: 34% of traffic is now AI crawler origin. News sites: 28%. Academic preprint servers: 61%. E-commerce product pages: 12%. Forums and community sites: 19%. The gap between human and bot traffic is closing fastest in technical verticals.',
      },
      {
        heading: 'Regulatory Landscape',
        body:    'The EU AI Act requires AI providers to publish summaries of training data used for general-purpose AI models starting August 2026. Japan amended its copyright law in 2024 to allow AI training on public web data without compensation, creating a multi-jurisdictional arbitrage challenge for publishers.',
      },
    ],
    _meta: {
      licence:      'full_display',
      pricePerPage: '$0.01',
      note:         'Premium content. Highest pricing tier. Reproduction without a valid ScraperKast token is prohibited.',
    },
  });
});

// GET /free/about — no pricing rule, human visitors pass freely, bots get 403
app.get('/free/about', (_req: Request, res: Response) => {
  res.json({
    about: 'ScraperKast is an open-source AI content monetisation platform.',
    mission: 'We believe content creators deserve compensation when their work is used to train or power AI systems. ScraperKast makes it easy to charge AI bots without breaking the experience for human visitors.',
    openSource: {
      licence:    'MIT',
      repository: 'https://github.com/your-org/scraperkast',
      contributing: 'PRs welcome! See CONTRIBUTING.md for guidelines.',
    },
    team: 'Built by indie developers who got tired of AI companies training on their content for free.',
    note: 'This page has no pricing rule — bots are blocked outright (403) because the site owner has not opted in to monetising it. Human visitors see this response.',
  });
});

// ─── 404 catch-all ────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', message: 'The requested path does not exist.' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const divider = paint(c.dim, '─'.repeat(60));

  console.log('');
  console.log(divider);
  console.log(`  ${paint(c.bold + c.magenta, '⚡ ScraperKast Demo')}  ${paint(c.dim, 'v0.1.0')}`);
  console.log(divider);
  console.log(`  ${paint(c.bold, 'URL')}    http://localhost:${PORT}`);
  console.log(`  ${paint(c.bold, 'Secret')} ${JWT_SECRET === 'dev-secret-change-in-production'
    ? paint(c.yellow, 'dev-secret-change-in-production  ⚠  not for production')
    : paint(c.green, '(from environment)')}
  `);
  console.log(`  ${paint(c.bold, 'Routes')}`);
  console.log(`    ${paint(c.green,   'GET')} /                    ${paint(c.dim, '→ landing page (humans only — bots 403)')}`);
  console.log(`    ${paint(c.green,   'GET')} /blog/:slug          ${paint(c.dim, '→ $0.001/page · summarization')}`);
  console.log(`    ${paint(c.green,   'GET')} /docs/api/:section   ${paint(c.dim, '→ $0.005/page · full_display')}`);
  console.log(`    ${paint(c.green,   'GET')} /premium/data        ${paint(c.dim, '→ $0.010/page · full_display')}`);
  console.log(`    ${paint(c.green,   'GET')} /free/about          ${paint(c.dim, '→ free  (humans only — bots 403)')}`);
  console.log('');
  console.log(`  ${paint(c.bold, 'Quick test — simulate GPTBot hitting /blog/intro-to-llms:')}`);
  console.log(`    ${paint(c.cyan, `curl -H "User-Agent: GPTBot/1.0" http://localhost:${PORT}/blog/intro-to-llms`)}`);
  console.log(divider);
  console.log('');
});
