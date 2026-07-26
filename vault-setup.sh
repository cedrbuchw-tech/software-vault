#!/usr/bin/env bash
#
# vault-setup.sh — set up the SoftwareVault website on a fresh Linux machine.
#
# You do NOT need the files first — this clones them from your GitHub repo, sets
# the folder up, and opens it in VSCode ready to run.
#
# Usage:
#   ./vault-setup.sh <git-url> [target-folder]
#   REPO=<git-url> ./vault-setup.sh
#   ./vault-setup.sh                 (it will ask for the git URL)
#
# Example:
#   ./vault-setup.sh https://github.com/you/software-vault.git ~/dev/softwarevault
#
# NOTE: it clones whatever is on your repo's default branch, so push your latest
# code first. Private repo? git will ask for a GitHub token (or use an SSH URL).
#
set -eu

# ── 1. repo URL ─────────────────────────────────────────────────────────────
REPO_URL="${1:-${REPO:-}}"
if [ -z "$REPO_URL" ]; then
  printf "Paste your GitHub repo URL (green 'Code' button → HTTPS or SSH): "
  read -r REPO_URL
fi
[ -z "$REPO_URL" ] && { echo "✗ No repo URL given."; exit 1; }

# ── 2. where to put it ──────────────────────────────────────────────────────
DEFAULT_DIR="$HOME/$(basename "$REPO_URL" .git)"
TARGET="${2:-$DEFAULT_DIR}"

# ── 3. prerequisites: git + Node ────────────────────────────────────────────
command -v git >/dev/null 2>&1 || { echo "✗ git isn't installed. Install git, then re-run."; exit 1; }
if ! command -v node >/dev/null 2>&1; then
  cat <<'MSG'
✗ Node.js isn't installed (the site is JavaScript/Next.js, not Python).
  Easiest on any Linux incl. the Steam Deck (whose root fs is read-only):
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
    # close & reopen the terminal, then:
    nvm install 20
  Or on Debian/Ubuntu:  sudo apt install nodejs npm
  Then re-run this script.
MSG
  exit 1
fi
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
[ "$NODE_MAJOR" -lt 18 ] && { echo "✗ Node $(node -v) is too old; need 18.18+ (nvm install 20)."; exit 1; }
echo "✓ git + Node $(node -v)"

# ── 4. clone (or update if it's already there) ──────────────────────────────
if [ -d "$TARGET/.git" ]; then
  echo "▸ $TARGET already exists — pulling latest…"
  git -C "$TARGET" pull --ff-only || echo "  (couldn't fast-forward; leaving as-is)"
elif [ -e "$TARGET" ]; then
  echo "✗ $TARGET exists but isn't a git repo. Choose another target folder."; exit 1
else
  echo "▸ Cloning into $TARGET …"
  git clone "$REPO_URL" "$TARGET"
fi
cd "$TARGET"

# some repos nest the app a level or two deep — find the real package.json
if [ ! -f package.json ]; then
  PKG="$(find . -maxdepth 3 -name package.json -not -path '*/node_modules/*' 2>/dev/null | head -n1 || true)"
  [ -n "$PKG" ] && cd "$(dirname "$PKG")"
fi
[ -f package.json ] || { echo "✗ No package.json found in the repo."; exit 1; }
echo "▸ Project root: $(pwd)"

# ── 5. scaffold .env.local (real values are secret + gitignored) ────────────
if [ ! -f .env.local ]; then
  cat > .env.local <<'ENV'
# Fill these from your Supabase project (Settings → API) and Resend.
# This file is gitignored — never commit it.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_SECRET=
RESEND_API_KEY=
ENV
  echo "📝 Created .env.local with blanks — paste your keys in it (see SETUP.md)."
else
  echo "✓ .env.local already present."
fi

# ── 6. VSCode niceties ──────────────────────────────────────────────────────
if [ ! -d .vscode ]; then
  mkdir -p .vscode
  cat > .vscode/extensions.json <<'JSON'
{
  "recommendations": ["dbaeumer.vscode-eslint", "esbenp.prettier-vscode"]
}
JSON
  cat > .vscode/settings.json <<'JSON'
{
  "files.eol": "\n",
  "search.exclude": { "**/node_modules": true, "**/.next": true }
}
JSON
  echo "✓ Added .vscode (recommended extensions + settings)."
fi

# ── 7. install deps (healing a node_modules built for another OS) ───────────
PLAT="$(node -p 'process.platform')"
if [ -d node_modules ] && ls node_modules/@next/swc-* >/dev/null 2>&1 && ! ls node_modules/@next/swc-"$PLAT"-* >/dev/null 2>&1; then
  echo "⚠  node_modules was built for another OS — wiping it."
  rm -rf node_modules .next package-lock.json
fi
if [ ! -d node_modules ]; then
  echo "→ Installing dependencies (a couple of minutes the first time)…"
  npm install
else
  echo "✓ Dependencies already installed."
fi

# ── 8. done → open VSCode ───────────────────────────────────────────────────
echo ""
echo "──────────────────────────────────────────────────────────────"
echo "✓ Ready. Project at: $(pwd)"
echo "  1) Put your Supabase keys in .env.local"
echo "  2) In Supabase → SQL editor run SETUP_SUPABASE.sql, then enable Email auth (SETUP.md)"
echo "  3) Run it:  npm run dev   (or ./vault.sh)   →   http://localhost:3000"
echo "──────────────────────────────────────────────────────────────"
if command -v code >/dev/null 2>&1; then
  echo "▸ Opening VSCode…"; code .
else
  echo "ℹ  'code' isn't on PATH — open VSCode → File → Open Folder → $(pwd)"
  echo "   (Enable it: in VSCode, Ctrl+Shift+P → 'Shell Command: Install code command in PATH'.)"
fi
