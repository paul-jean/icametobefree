#!/usr/bin/env bash
# One-shot first deploy to GitHub Pages.
#
#   bash scripts/deploy.sh [repo-name]
#
# Creates the repo, pushes, and switches Pages to the Actions source.
# Safe to re-run: it skips whatever is already done.
# After this, deploying is just `git push`.

set -euo pipefail

REPO_NAME="${1:-icametobefree}"
cd "$(dirname "$0")/.."

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mx %s\033[0m\n' "$*" >&2; exit 1; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }

# --- preflight ------------------------------------------------------------
command -v git >/dev/null || fail "git isn't installed. Install Xcode tools: xcode-select --install"

if ! command -v gh >/dev/null; then
  fail "The GitHub CLI (gh) isn't installed — it's what creates the repo and turns Pages on.
  Install it:  brew install gh
  Then:        gh auth login
  Then re-run this script.

  (Prefer to do it by hand? See the 'Deploying' section of README.md.)"
fi

if ! gh auth status >/dev/null 2>&1; then
  fail "You're not logged in to GitHub. Run:  gh auth login   then re-run this script."
fi

say "Validating content before anything ships…"
python3 scripts/check.py || fail "quotes.json has errors — fix them before deploying."

# --- local repo -----------------------------------------------------------
say "Preparing the local repository…"
if [ ! -d .git ]; then
  git init -q
  git branch -M main
  ok "git repo initialised"
else
  ok "git repo already exists"
fi

git add -A
if git diff --cached --quiet 2>/dev/null && git rev-parse HEAD >/dev/null 2>&1; then
  ok "nothing new to commit"
else
  git commit -qm "Promo site for I came to be free" || true
  ok "changes committed"
fi

# --- remote ---------------------------------------------------------------
if git remote get-url origin >/dev/null 2>&1; then
  ok "remote 'origin' already set: $(git remote get-url origin)"
  say "Pushing…"
  git push -u origin main
else
  say "Creating the GitHub repo and pushing…"
  # Pages needs a public repo unless you're on a paid plan.
  gh repo create "$REPO_NAME" --public --source=. --remote=origin --push \
    --description "Promo site for 'I came to be free' — poems by PJ Starling"
fi
ok "pushed to GitHub"

# --- pages ----------------------------------------------------------------
SLUG=$(gh repo view --json nameWithOwner -q .nameWithOwner)

say "Switching Pages to the GitHub Actions source…"
if gh api "repos/$SLUG/pages" >/dev/null 2>&1; then
  gh api -X PUT "repos/$SLUG/pages" -f build_type=workflow >/dev/null
  ok "Pages already on — source set to Actions"
else
  gh api -X POST "repos/$SLUG/pages" -f build_type=workflow >/dev/null
  ok "Pages enabled with the Actions source"
fi

# --- done -----------------------------------------------------------------
say "Deployed. The build takes about a minute."
echo "  Watch it:   gh run watch"
echo "  Then visit: https://$(echo "$SLUG" | cut -d/ -f1).github.io/$(echo "$SLUG" | cut -d/ -f2)/"
echo ""
echo "  From now on, publishing a change is just:  git push"
echo ""
echo "  Custom domain? Put it in a CNAME file at the repo root, push,"
echo "  and follow the DNS table in README.md."
