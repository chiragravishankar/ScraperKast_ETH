# GitHub Setup Guide

Follow these steps to push ScraperKast to GitHub for the first time.
The whole process takes about 5 minutes.

---

## Step 1 — Create the repository on GitHub

1. Open [github.com/new](https://github.com/new) in your browser.
2. Fill in the form:

   | Field | Value |
   |---|---|
   | **Repository name** | `scraperkast` |
   | **Description** | AI bot paywall for Express.js — open-source alternative to TollBit |
   | **Visibility** | ✅ Public |
   | **Initialize this repository with a README** | ❌ Leave unchecked — we already have one |
   | **Add .gitignore** | ❌ Leave as "None" — we already have one |
   | **Choose a license** | ❌ Leave as "None" — we already have `LICENSE` |

3. Click **"Create repository"**.

You'll see a page with setup instructions — **ignore them**, we have our own
commands below.

---

## Step 2 — Push from your terminal

Open a terminal in the project root (`scraperkast/`) and run these commands
one at a time. Each line is explained below.

```bash
# 1. Initialise a git repository in the current directory
git init

# 2. Stage every file that isn't in .gitignore
git add .

# 3. Create the first commit
git commit -m "feat: initial commit — ScraperKast v0.1.0

Packages:
- @scraperkast/core v0.1.0 (bot detection, pricing, auth, analytics)
- @scraperkast/middleware-express v0.1.0 (Express middleware)

Extras:
- examples/express-demo — runnable demo app with test-bot CLI
- apps/landing — Next.js 14 landing page
- docs/ — full documentation (8 guides)
- CONTRIBUTING.md, LICENSE (MIT)"

# 4. Rename the default branch to 'main'
#    (GitHub uses 'main' as the default — this keeps them in sync)
git branch -M main

# 5. Point your local repo at GitHub
#    Replace YOUR_USERNAME if you haven't already cloned from this URL
git remote add origin https://github.com/chiragravishankar/scraperkast.git

# 6. Push and set the upstream tracking branch
git push -u origin main
```

After step 6, refresh [github.com/chiragravishankar/scraperkast](https://github.com/chiragravishankar/scraperkast) —
you should see all your files.

---

## Step 3 — Verify everything looks right

Open the repository on GitHub and check:

```
□ README.md renders correctly (badges, code block, table)
□ LICENSE file is present (GitHub auto-detects MIT and shows the badge)
□ .gitignore is present
□ packages/, examples/, apps/, docs/ directories are all there
□ node_modules/ is NOT visible (it's in .gitignore)
□ .env files are NOT visible (they're in .gitignore)
□ .next/ is NOT visible (it's in .gitignore)
```

---

## Step 4 — Add repository topics (optional but recommended)

Topics help people discover your project on GitHub.

1. On the repo page, click the ⚙️ gear icon next to **"About"** (top right).
2. Add these topics:

   ```
   ai  express  middleware  bot-detection  monetization  open-source
   typescript  nodejs  tollbit  gptbot  content-protection
   ```

3. Click **Save changes**.

---

## Step 5 — Set up GitHub Actions (optional)

You can add a simple CI workflow to run tests on every push.

Create this file: `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Test on Node ${{ matrix.node }}
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node: ['18', '20', '22']

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build packages
        run: npm run build --workspaces --if-present

      - name: Run tests
        run: npm test --workspaces --if-present
```

Commit and push this file to enable the CI badge in your README.

---

## Step 6 — Publish to npm (when you're ready)

> Only do this when you're happy with the code. You can't unpublish npm packages
> after 72 hours.

```bash
# Log in to npm (one-time setup)
npm login

# Publish @scraperkast/core first (middleware depends on it)
cd packages/core
npm publish --access public

# Then publish the middleware
cd ../middleware-express
npm publish --access public
```

The `prepublishOnly` script runs `npm run build && npm test` automatically
before publishing, so the registry always gets a passing, compiled package.

After publishing, the npm badges in `README.md` will resolve to real version
numbers automatically.

---

## Troubleshooting

### `git remote add origin` fails with "remote origin already exists"

```bash
# Remove the existing remote and re-add
git remote remove origin
git remote add origin https://github.com/chiragravishankar/scraperkast.git
```

### `git push` fails with "authentication failed"

GitHub removed password authentication in 2021. Use one of these instead:

**Option A — Personal Access Token (simplest):**
1. Go to [github.com/settings/tokens](https://github.com/settings/tokens/new)
2. Create a token with the `repo` scope
3. Use the token as your password when git prompts for credentials

**Option B — SSH (recommended for ongoing development):**
```bash
# Generate an SSH key (if you don't have one)
ssh-keygen -t ed25519 -C "your@email.com"

# Copy the public key
cat ~/.ssh/id_ed25519.pub

# Paste it at: github.com/settings/keys → "New SSH key"

# Switch the remote to SSH
git remote set-url origin git@github.com:chiragravishankar/scraperkast.git

# Push
git push -u origin main
```

### Files I expected to be on GitHub are missing

Run `git status` to see what's staged and what's excluded. If a file you
want to commit is being ignored, check `.gitignore` — you may need to
remove a pattern or add a `!` exception (e.g. `!.env.example` keeps
example files even though `.env.*` is ignored).

### The README badges show "unknown" or errors

The npm badges won't resolve until you publish the packages. The GitHub
Actions badge won't show until you've pushed at least one CI run. Both
will resolve automatically after those steps.

---

## After pushing — next steps

- **Star your own repo** so it shows up in your GitHub activity
- **Share it**: post on [r/node](https://reddit.com/r/node),
  [dev.to](https://dev.to), or [Hacker News (Show HN)](https://news.ycombinator.com/showhn.html)
- **Publish to npm** when the code is ready (Step 6 above)
- **Set up the landing page** on Vercel:
  ```bash
  # In apps/landing/
  npx vercel
  ```
  Point your domain's DNS to Vercel and set `NEXT_PUBLIC_*` env vars in
  the Vercel dashboard
- **Create a v0.1.0 release tag** on GitHub:
  ```bash
  git tag v0.1.0
  git push origin v0.1.0
  ```
  Then go to Releases on GitHub and write release notes
