#!/usr/bin/env bash
# Skip npm ci when node_modules/.lock-hash matches package-lock.json.
# Modules live in ~/.cache/pickleball-bot. actions/checkout replaces the
# workspace, and this repo commits an older node_modules, so a stamp inside
# the workspace would not survive the next run.
set -euo pipefail

if [ "${GITHUB_ACTIONS:-}" != "true" ]; then
  echo "ensure-node-modules.sh only runs in GitHub Actions" >&2
  exit 1
fi

ROOT="${PICKLEBALL_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"
CACHE="${PICKLEBALL_DEPS_CACHE:-$HOME/.cache/pickleball-bot}"
mkdir -p "$CACHE"

hash=$(sha256sum "$ROOT/package-lock.json" | awk '{print $1}')
modules="$CACHE/node_modules"
stamp="$modules/.lock-hash"

use_cache() {
  rm -rf "$ROOT/node_modules"
  ln -sfn "$modules" "$ROOT/node_modules"
}

if [ -f "$stamp" ] && [ "$(<"$stamp")" = "$hash" ] && [ -d "$modules/playwright" ]; then
  echo "skip npm ci: node_modules matches package-lock.json"
  use_cache
  exit 0
fi

echo "npm ci: node_modules missing or lock changed"
rm -rf "$modules"
cp "$ROOT/package.json" "$ROOT/package-lock.json" "$CACHE/"
npm ci --prefix "$CACHE"
printf '%s\n' "$hash" > "$stamp"
use_cache
