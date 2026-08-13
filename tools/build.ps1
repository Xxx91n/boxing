# Boxing - thin wrapper, delegates to canonical cross-platform build.mjs
# The real build logic lives in .github/scripts/build.mjs (Node.js, zero deps)
$ErrorActionPreference = "Stop"
$Root = Resolve-Path "$PSScriptRoot/.."
exec node "$Root/.github/scripts/build.mjs" @args
