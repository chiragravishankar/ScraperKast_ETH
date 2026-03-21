# Contributing to ScraperKast

First off — thank you for being here. 🎉

ScraperKast is community-driven and every contribution matters, whether that's
a bug report, a typo fix, a new middleware adapter, or just telling a friend
about the project. **No contribution is too small, and we mean it.**

If this is your first time contributing to an open-source project, welcome —
this is a great place to start. We'll help you through the process.

---

## Code of Conduct

This project is built on a simple premise: **be kind**.

- Treat everyone with respect, regardless of experience level, background, or opinion.
- Give feedback on code, not on people.
- Assume good intent — most misunderstandings come from different context, not malice.
- No harassment, discrimination, or personal attacks of any kind.

If something feels off, please open a private issue or email us directly.
We take this seriously and will act on it.

We are here to build something genuinely useful together. That only works in a
space where everyone feels safe to ask questions and make mistakes.

---

## Ways to contribute

You don't need to write code to contribute. There are lots of ways to help:

| Contribution | Where |
|---|---|
| 🐛 Report a bug | [GitHub Issues](https://github.com/chiragravishankar/scraperkast/issues) |
| 💡 Suggest a feature | [GitHub Discussions](https://github.com/chiragravishankar/scraperkast/discussions) |
| 🔧 Submit a bug fix or feature | Pull request |
| 📖 Improve documentation | Pull request to `docs/` or inline comments |
| 🌍 Translate documentation | Pull request |
| ⭐ Star the repo | [GitHub](https://github.com/chiragravishankar/scraperkast) |
| 📣 Tell someone about it | Anywhere |

---

## Development setup

### Prerequisites

- **Node.js 18+** — check with `node --version`
- **npm 9+** — check with `npm --version`
- Git

### Get the code running

```bash
# 1. Fork the repo on GitHub, then clone your fork
git clone https://github.com/YOUR_USERNAME/scraperkast.git
cd scraperkast

# 2. Install all workspace dependencies in one shot
npm install

# 3. Build all packages
npm run build --workspaces --if-present

# 4. Run the full test suite
npm test --workspaces --if-present
```

If everything is green, you're ready to go.

### Run tests for a specific package

```bash
# Core utilities only
cd packages/core && npm test

# Express middleware only
cd packages/middleware-express && npm test
```

### Start the demo app

```bash
cd examples/express-demo
cp .env.example .env          # copy the example env file
npm run dev                   # starts on http://localhost:3000
```

### Common commands

| Command | What it does |
|---|---|
| `npm test --workspaces` | Run all tests across all packages |
| `npm run build --workspaces` | Compile TypeScript for all packages |
| `npm run clean --workspaces` | Delete all `dist/` and build-info files |
| `npm run test:watch` (in a package) | Re-run tests on file change |

---

## Project structure

```
scraperkast/
├── packages/
│   ├── core/                  # @scraperkast/core
│   │   └── src/
│   │       ├── botDetection.ts     # User-agent regex matching
│   │       ├── pricing.ts          # Rule-based pricing engine
│   │       ├── auth.ts             # JWT generation + verification
│   │       └── analytics.ts        # In-memory event tracking
│   │
│   └── middleware-express/    # @scraperkast/middleware-express
│       └── src/
│           └── index.ts            # Express RequestHandler factory
│
├── examples/
│   └── express-demo/          # Runnable demo app
│       ├── src/server.ts
│       ├── test-bot.ts         # CLI bot simulator
│       └── DEMO.md             # Step-by-step demo script
│
├── docs/                      # Documentation (Markdown)
├── tsconfig.base.json         # Shared TypeScript config
├── package.json               # Workspace root
├── LICENSE                    # MIT
└── CONTRIBUTING.md            # You are here
```

New to the codebase? Start with `packages/core/src/botDetection.ts` — it's
the smallest, most self-contained module, and a good first issue lives there
(see [Areas we need help](#areas-we-need-help) below).

---

## Coding standards

We aim for code that is easy to read, easy to test, and easy to change.
Here's what that means in practice:

### TypeScript
- **Strict mode is on** (`"strict": true` in tsconfig). No `any`, no type
  assertions unless there's a documented reason.
- Prefer `interface` for object shapes that are part of the public API;
  `type` for unions, aliases, and internal helpers.
- Export types alongside values when a consumer might need them.

### Tests
- **Every new function needs a test.** If you add a feature, add a test.
  If you fix a bug, add a regression test.
- Tests live alongside source files as `*.test.ts`.
- Use descriptive test names: `it('returns null when no rule matches')` not
  `it('works')`.

### Code style
- Format with the project's existing style (2-space indent, single quotes,
  trailing commas in multiline). We'll add a formatter config soon — in the
  meantime, match the surrounding code.
- Keep functions small and focused. If you need to scroll to read a function,
  it probably wants to be split.
- Prefer explicit over clever. Code is read far more often than it's written.

### Documentation
- If you add a public function or interface, add a JSDoc comment.
- If your change affects a README, update it in the same PR.
- If you add a new config option to the middleware, update
  `packages/middleware-express/README.md`.

### PRs
- **One feature per PR.** Smaller PRs get reviewed faster and are easier to
  reason about.
- Keep PRs out of unrelated files. Avoid formatting sweeps mixed with logic
  changes.
- Fill in the PR description template — it speeds up review significantly.

---

## PR process

```
1. Fork the repo on GitHub
        │
        ▼
2. Create a feature branch
   git checkout -b feature/my-feature
        │
        ▼
3. Make your changes + write tests
        │
        ▼
4. Confirm tests pass
   npm test --workspaces --if-present
        │
        ▼
5. Commit with a clear message
   git commit -m "feat(core): add CloudflareBot to bot detection"
        │
        ▼
6. Push to your fork
   git push origin feature/my-feature
        │
        ▼
7. Open a PR against scraperkast/main
        │
        ▼
8. A maintainer reviews within 1–3 days
   — address any feedback, push updates
        │
        ▼
9. Merged! 🎉
```

### Commit message format

We follow [Conventional Commits](https://www.conventionalcommits.org/) loosely:

```
<type>(<scope>): <short summary>

Types: feat | fix | docs | test | refactor | chore
Scope: core | middleware-express | demo | root

Examples:
  feat(core): add YouBot to bot detection
  fix(middleware-express): handle missing Authorization header gracefully
  docs: update middleware README pricing table
  test(core): add regression test for wildcard path matching
```

This isn't mandatory for first-time contributors — we can help clean it up
during review.

---

## Areas we need help

These are real gaps where contributions would have the most impact.

### Good first issues (start here)
These require minimal context and are well-scoped:

- **Add a new bot to detection** — pick any AI bot not yet in
  `packages/core/src/botDetection.ts`, add its User-Agent pattern, type,
  and a test. Takes ~30 minutes.
  [Browse the list of known AI bots →](https://github.com/chiragravishankar/scraperkast/issues)
- **Fix a typo or unclear doc** — if something confused you, it'll confuse
  others. Fix it.
- **Add an edge case to an existing test file** — look for a path through
  the code that isn't tested and write a test for it.
- **Add `.env` validation to the demo app** — the demo should print a
  friendly error if `JWT_SECRET` is missing rather than crashing.

### Medium complexity
- **Next.js middleware adapter** — `packages/middleware-nextjs` using the
  Next.js Edge Runtime middleware API (`NextResponse`).
- **Fastify plugin** — `packages/plugin-fastify` using Fastify's
  `addHook('onRequest')` lifecycle.
- **Persistence layer for analytics** — swap the in-memory
  `AnalyticsCollector` for an optional SQLite or Postgres backend via a
  plugin interface.
- **Token credit decrement** — right now the middleware checks `credits > 0`
  but doesn't decrement. Add an optional callback + a reference
  implementation.

### Larger projects
- **Analytics dashboard** — a Next.js/React app that reads from the
  `getStats()` API and renders charts. Great for a portfolio project.
- **ML-based bot detection** — supplement User-Agent matching with
  behavioural signals (request timing, header ordering, TLS fingerprint).
- **Django / Flask middleware** — a Python port. The architecture maps
  cleanly — `detectBot`, `PricingEngine`, and `AuthService` all have
  obvious Python equivalents.
- **Rails / Laravel adapters** — same idea for Ruby and PHP ecosystems.
- **Documentation site** — a Docusaurus or Starlight site to replace the
  current Markdown-only docs.
- **Translations** — translate `README.md` and `CONTRIBUTING.md` into
  other languages.

If you want to take on a larger project, **open a discussion first** before
writing code. That way we can align on the design and you won't waste effort
on something that needs rethinking.

---

## Questions?

If something is unclear, please ask — there are no stupid questions here.

- **GitHub Discussions** — best place for open-ended questions, design ideas,
  and "would this be welcome?" conversations:
  [github.com/chiragravishankar/scraperkast/discussions](https://github.com/chiragravishankar/scraperkast/discussions)
- **GitHub Issues** — for concrete bugs and well-defined feature requests:
  [github.com/chiragravishankar/scraperkast/issues](https://github.com/chiragravishankar/scraperkast/issues)
- **Email** — for anything that shouldn't be public:
  your-email@example.com
- **Discord** — we'll add a server once the community grows enough to
  warrant it. Watch the Discussions board for the announcement.

---

Thank you for making ScraperKast better. Every contribution — no matter
how small — moves the project forward. We're glad you're here. 🚀
