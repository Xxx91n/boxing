#!/usr/bin/env bash
# Boxing — thin wrapper, delegates to canonical cross-platform build.mjs
# The real build logic lives in .github/scripts/build.mjs (Node.js, zero deps)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec node "$ROOT/.github/scripts/build.mjs" "$@"
