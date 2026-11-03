#!/usr/bin/env bash
# Hash gate only. The npm stub never installs real packages.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

mkdir -p "$TMP/bin" "$TMP/proj" "$TMP/cache"
cat > "$TMP/proj/package.json" <<'EOF'
{"name":"fixture","version":"1.0.0"}
EOF
printf 'lock-v1\n' > "$TMP/proj/package-lock.json"
cat > "$TMP/bin/npm" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >> "$NPM_LOG"
prefix=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "--prefix" ]; then
    prefix=$arg
  fi
  prev=$arg
done
mkdir -p "$prefix/node_modules/playwright"
sleep 0.2
EOF
chmod +x "$TMP/bin/npm"

export GITHUB_ACTIONS=true
export PICKLEBALL_ROOT="$TMP/proj"
export PICKLEBALL_DEPS_CACHE="$TMP/cache"
export NPM_LOG="$TMP/npm.log"
export PATH="$TMP/bin:$PATH"
export HOME="$TMP/home"
mkdir -p "$HOME"

bash "$ROOT/scripts/ensure-node-modules.sh" >"$TMP/out1"
test -s "$NPM_LOG"
test -f "$TMP/proj/node_modules/.lock-hash"
test -d "$TMP/proj/node_modules/playwright"
grep -q 'npm ci:' "$TMP/out1"

calls=$(wc -l < "$NPM_LOG")
bash "$ROOT/scripts/ensure-node-modules.sh" >"$TMP/out2"
test "$(wc -l < "$NPM_LOG")" -eq "$calls"
grep -q 'skip npm ci' "$TMP/out2"

printf 'lock-v2\n' > "$TMP/proj/package-lock.json"
bash "$ROOT/scripts/ensure-node-modules.sh" >"$TMP/out3"
test "$(wc -l < "$NPM_LOG")" -eq $((calls + 1))
grep -q 'npm ci:' "$TMP/out3"

rm -rf "$TMP/cache" "$TMP/proj/node_modules"
: > "$NPM_LOG"
printf 'lock-v1\n' > "$TMP/proj/package-lock.json"
bash "$ROOT/scripts/ensure-node-modules.sh" >"$TMP/par-a" &
bash "$ROOT/scripts/ensure-node-modules.sh" >"$TMP/par-b" &
wait
test "$(wc -l < "$NPM_LOG")" -eq 1
cat "$TMP/par-a" "$TMP/par-b" | grep -q 'skip npm ci'
echo "ensure-node-modules tests passed"
