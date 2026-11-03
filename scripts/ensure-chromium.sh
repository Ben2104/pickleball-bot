#!/usr/bin/env bash
# Hold the shared Chromium cache lock for the whole check and install.
# Five runner instances start together and may share ~/.cache/ms-playwright.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cache="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
mkdir -p "$cache"
exec 9>"$cache/install.lock"
flock 9
node "$ROOT/scripts/ensure-chromium.js"
