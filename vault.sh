#!/usr/bin/env bash
#
# vault.sh — one-command setup & run for the SoftwareVault website (Linux)
#
# Just have the project files, then run this. It checks Node, fixes a
# node_modules copied from another OS, installs dependencies, and starts the site.
#
# Usage:
#   ./vault.sh                 start the dev server (installs deps if needed)
#   ./vault.sh --clean         wipe node_modules/.next/lockfile, reinstall, then run
#   ./vault.sh --build         production build, then start the production server
#   ./vault.sh --no-run        only install dependencies, don't start anything
#   ./vault.sh --commit "msg"  build to verify it compiles, then git add+commit+push
#   ./vault.sh --help          show this help
#
set -euo pipefail

# ── 0. arg parsing ──────────────────────────────────────────────────────────
CLEAN=0; BUILD=0; RUN=1; COMMIT_MSG=""
while [ $# -gt 0 ]; do
  case "$1" in
    --clean)  CLEAN=1 ;;
    --build)  BUILD=1 ;;
    --no-run) RUN=0 ;;
    --commit) shift; COMMIT_MSG="${1:-Update}" ;;
    -h|--help) awk 'NR>1{ if(/^#/){sub(/^#[[:space:]]?/,"");print} else exit }' "$0"; exit 0 ;;
    *) echo "Unknown option: $1  (try --help)"; exit 1 ;;
  esac
  shift
done

# ── 1. find the project (folder with package.json) ──────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
if   [ -f "$SCRIPT_DIR/package.json" ]; then cd "$SCRIPT_DIR"
elif [ -f "./package.json" ];          then :
else
  echo "✗ Can't find package.json."
  echo "  Put vault.sh in the website folder (the one with package.json), or run it from there."
  exit 1
fi
echo "▸ Project: $(pwd)"

# ── 2. Node.js present and new enough? ──────────────────────────────────────
if ! command -v node >/dev/null 2>&1; then
  cat <<'MSG'
✗ Node.js isn't installed. (The website is JavaScript/Next.js — no Python venv here.)
  Easiest way on any Linux incl. the Steam Deck (whose root fs is read-only):

    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    # close & reopen the terminal, then:
    nvm install 20

  (Or grab the latest install line from https://github.com/nvm-sh/nvm)
  On Debian/Ubuntu instead:  sudo apt install nodejs npm
  Then re-run this script.
MSG
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "✗ Node $(node -v) is too old — Next.js needs Node 18.18+ (20 LTS recommended)."
  echo "  With nvm:  nvm install 20 && nvm use 20"
  exit 1
fi
echo "✓ Node $(node -v), npm $(npm -v)"

# ── 3. heads-up if the Supabase env file is missing ─────────────────────────
if [ ! -f .env.local ]; then
  echo "⚠  No .env.local found — the site will start, but accounts / likes / library"
  echo "   won't work until you add your Supabase keys (see SETUP.md)."
fi

# ── 4. heal a node_modules copied from another OS (the Windows-copy problem) ─
PLAT="$(node -p 'process.platform')"   # linux / darwin / win32
if [ -d node_modules ] && [ "$CLEAN" -eq 0 ]; then
  if ls node_modules/@next/swc-* >/dev/null 2>&1 && ! ls node_modules/@next/swc-"$PLAT"-* >/dev/null 2>&1; then
    echo "⚠  node_modules was built for a different OS (no SWC binary for '$PLAT')."
    echo "   → wiping and reinstalling cleanly so it works here."
    CLEAN=1
  fi
fi

# ── 5. install dependencies ─────────────────────────────────────────────────
if [ "$CLEAN" -eq 1 ]; then
  echo "→ Clean: removing node_modules, .next, package-lock.json"
  rm -rf node_modules .next package-lock.json
fi
if [ "$CLEAN" -eq 1 ] || [ ! -d node_modules ]; then
  echo "→ Installing dependencies (a couple of minutes the first time)…"
  npm install
else
  echo "✓ Dependencies already installed (use --clean to force a fresh install)."
fi

# ── 6. commit flow (build to verify, then push) ─────────────────────────────
if [ -n "$COMMIT_MSG" ]; then
  echo "→ Building to make sure it compiles before committing…"
  npm run build
  if git rev-parse --git-dir >/dev/null 2>&1; then
    echo "→ Committing and pushing…"
    git add -A
    if git diff --cached --quiet; then
      echo "  (nothing new to commit)"
    else
      git commit -m "$COMMIT_MSG"
    fi
    git push && echo "✓ Pushed — your host (e.g. Vercel) will deploy. Remember: run SETUP_SUPABASE.sql in Supabase if you haven't."
  else
    echo "⚠  This folder isn't a git repo, so nothing was committed."
  fi
  exit 0
fi

# ── 7. run (or stop after install) ──────────────────────────────────────────
if [ "$RUN" -eq 0 ]; then
  echo "✓ Done — dependencies installed (--no-run, so not starting the server)."
  exit 0
fi

if [ "$BUILD" -eq 1 ]; then
  echo "→ Production build…"
  npm run build
  echo "→ Starting production server → http://localhost:3000   (Ctrl+C to stop)"
  npm run start
else
  echo "→ Starting dev server → http://localhost:3000   (Ctrl+C to stop)"
  npm run dev
fi
