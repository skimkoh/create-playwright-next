# 🎭 create-playwright-next

Set up Playwright in your existing Next.js project — instantly.

Inspired by tools like Create React App, this CLI bootstraps a fully working Playwright testing setup with sensible defaults, so you can start writing end-to-end tests immediately.

---

## ✨ Features

- ⚡ One-command setup via `npx`
- 🎭 Pre-configured Playwright setup
- 📁 Flexible test directory structure
- 🧪 Example test included
- 🔧 Auto-updates your `package.json` scripts
- 🚀 Optional browser installation
- 💅 Clean CLI UX using modern tooling

---

## 🚀 Quick Start

```bash
npx create-playwright-next init
```

The setup also creates `.github/workflows/playwright.yml`, which runs the
Playwright tests on pushes, pull requests, and manual dispatches. It uses the
local Next.js server by default. To run against a UAT environment instead, add
a `PLAYWRIGHT_BASE_URL` repository variable in **Settings → Secrets and
variables → Actions → Variables**.

For tests that sign in to UAT, add `UAT_EMAIL` and `UAT_PASSWORD` as repository
secrets in **Settings → Secrets and variables → Actions → Secrets**. The
workflow exposes them as environment variables for the test process; tests can
read them through `process.env.UAT_EMAIL` and `process.env.UAT_PASSWORD`.
During setup, the CLI can optionally add these secrets for you if GitHub CLI is
installed and pointed at the intended repository. If it is missing, the CLI
offers to install it using Homebrew on macOS, WinGet on Windows, or an available
APT, DNF, YUM, or Pacman package manager on Linux. If you are not signed in,
the CLI offers to launch GitHub's browser sign-in and resumes setup when
authentication completes. Credential values are sent directly to `gh secret
set` via stdin and are not written to project files.

GitHub does not provide repository secrets to workflows triggered by pull
requests from forks. Configure your workflow triggers accordingly if forked
contributions are expected.