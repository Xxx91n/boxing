#!/usr/bin/env bash
# Boxing Extension — Build & Package Script (v3.6.5+)
# No hardcoded paths. Works on Linux/macOS: CI/CD, local dev, or cross-platform.
# Mirrors tools/build.ps1 for Windows.
#
# Usage:
#   ./tools/build.sh              # create unsigned .zip
#   ./tools/build.sh --crx        # create .crx for Chromium (needs .pem key)
#   ./tools/build.sh --firefox    # create Firefox-unsigned .zip
#   ./tools/build.sh --clean      # remove build artifacts
#
# Output lands in ./package/ directory (gitignored).

set -euo pipefail

CRX=false
FIREFOX=false
CLEAN=false
OUTDIR="package"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --crx)     CRX=true; shift ;;
    --firefox) FIREFOX=true; shift ;;
    --clean)   CLEAN=true; shift ;;
    --out)     OUTDIR="$2"; shift 2 ;;
    *)         echo "Unknown option: $1"; exit 1 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MANIFEST="$ROOT/manifest.json"

step() { echo -e "\033[36m==> $1\033[0m"; }

# ── Clean ───────────────────────────────────────
if [ "$CLEAN" = true ]; then
  step "Cleaning build artifacts..."
  rm -rf "$ROOT/$OUTDIR"
  rm -f "$ROOT"/*.crx "$ROOT"/*.zip "$ROOT"/*.xpi 2>/dev/null || true
  echo "  Clean complete."
  exit 0
fi

# ── Validate project ────────────────────────────
if [ ! -f "$MANIFEST" ]; then
  echo "manifest.json not found — are you running from boxing root?" >&2
  exit 1
fi

VERSION=$(node -e "console.log(require(process.argv[1]).version)" -- "$MANIFEST")
NAME=$(node -e "console.log(require(process.argv[1]).name)" -- "$MANIFEST")

step "Building $NAME v$VERSION"

# ── Prepare output ──────────────────────────────
PKGDIR="$ROOT/$OUTDIR"
mkdir -p "$PKGDIR"

# ── Chrome/Chromium .zip (unsigned) ─────────────
ZIPNAME="$NAME-v$VERSION-chromium.zip"
ZIPPATH="$PKGDIR/$ZIPNAME"

step "Zipping Chromium package..."
if command -v zip >/dev/null 2>&1; then
  (cd "$ROOT" && zip -r -q "$ZIPPATH" . \
    -x '.git/*' '.gitignore' '.gitattributes' \
       'node_modules/*' '.vscode/*' '.idea/*' \
       '.codex/*' '.omx/*' '.codegraph/*' \
       "$OUTDIR/*" 'tools/*' \
       'META-INF/*' '_metadata/*' \
       '*.pem' '*.crx' '*.zip' '*.xpi' \
       'debug_*.png' 'debug_*.jpg' '.DS_Store' \
       '*.tmp' '*.log' 'tmp/*' \
       'fonts/*' 'images/*' \
       'dist/*' 'test/*' 'playwright-report/*' 'test-results/*')
else
  echo "  zip not found, using tar fallback..."
  TARGZ="${ZIPPATH%.zip}.tar.gz"
  (cd "$ROOT" && tar czf "$TARGZ" \
    --exclude='.git' --exclude='node_modules' --exclude='.vscode' --exclude='.idea' \
    --exclude='.codex' --exclude='.omx' --exclude='.codegraph' \
    --exclude="$OUTDIR" --exclude='tools' --exclude='META-INF' --exclude='_metadata' \
    --exclude='*.pem' --exclude='*.crx' --exclude='*.zip' --exclude='*.xpi' \
    --exclude='dist' --exclude='test' --exclude='playwright-report' --exclude='test-results' \
    --exclude='*.tmp' --exclude='*.log' --exclude='tmp' --exclude='fonts' --exclude='images' \
    .)
  echo "  Created $TARGZ (zip not available)"
fi
echo "  $ZIPPATH ($(du -k "$ZIPPATH" 2>/dev/null | cut -f1) KB)"

# ── Firefox .zip (unsigned, no META-INF) ────────
if [ "$FIREFOX" = true ]; then
  FXZIP="$NAME-v$VERSION-firefox.zip"
  FXZIPP="$PKGDIR/$FXZIP"
  step "Zipping Firefox package..."
  if command -v zip >/dev/null 2>&1; then
    (cd "$ROOT" && zip -r -q "$FXZIPP" . \
      -x '.git/*' '.gitignore' '.gitattributes' \
         'node_modules/*' '.vscode/*' '.idea/*' \
         '.codex/*' '.omx/*' '.codegraph/*' \
         "$OUTDIR/*" 'tools/*' \
         'META-INF/*' '_metadata/*' \
         '*.pem' '*.crx' '*.zip' '*.xpi' \
         'debug_*.png' 'debug_*.jpg' '.DS_Store' \
         '*.tmp' '*.log' 'tmp/*' \
         'fonts/*' 'images/*' \
         'dist/*' 'test/*' 'playwright-report/*' 'test-results/*')
  else
    cp "$ZIPPATH" "$FXZIPP"
  fi
  echo "  $FXZIPP ($(du -k "$FXZIPP" 2>/dev/null | cut -f1) KB)"
fi

# ── Chromium .crx (signed with .pem) ────────────
if [ "$CRX" = true ]; then
  step "Creating CRX (Chromium signed package)..."
  PEM_FILE=$(ls "$ROOT"/*.pem 2>/dev/null | head -1)
  if [ -z "$PEM_FILE" ]; then
    echo "  WARNING: No .pem key found. Generating new one..."
    if command -v openssl >/dev/null 2>&1; then
      openssl genrsa -out "$ROOT/boxing.pem" 2048 2>/dev/null
      PEM_FILE="$ROOT/boxing.pem"
    elif command -v node >/dev/null 2>&1; then
      node -e "
        const crypto = require('crypto');
        const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
        require('fs').writeFileSync(process.argv[1], privateKey.export({ type: 'pkcs1', format: 'pem' }));
      " -- "$ROOT/boxing.pem"
      PEM_FILE="$ROOT/boxing.pem"
    else
      echo "  ERROR: Cannot generate .pem — install OpenSSL or Node.js" >&2
      exit 1
    fi
  fi
  echo "  Using key: $PEM_FILE"

  if command -v npx >/dev/null 2>&1; then
    CRXFILE="$PKGDIR/$NAME-v$VERSION.crx"
    TMPSRC="$PKGDIR/.tmp-crx-source"
    rm -rf "$TMPSRC"; mkdir -p "$TMPSRC"
    (cd "$ROOT" && rsync -a \
      --exclude='.git' --exclude='node_modules' --exclude='.vscode' \
      --exclude='.idea' --exclude='.codex' --exclude='.omx' --exclude='.codegraph' \
      --exclude="$OUTDIR" --exclude='tools' --exclude='META-INF' --exclude='_metadata' \
      --exclude='*.pem' --exclude='*.crx' --exclude='*.zip' --exclude='*.xpi' \
      --exclude='dist' --exclude='test' --exclude='playwright-report' --exclude='test-results' \
      --exclude='*.tmp' --exclude='*.log' --exclude='tmp' --exclude='fonts' --exclude='images' \
      . "$TMPSRC/")
    npx --yes crx3 pack "$TMPSRC" -o "$CRXFILE" -p "$PEM_FILE"
    rm -rf "$TMPSRC"
    echo "  $CRXFILE ($(du -k "$CRXFILE" 2>/dev/null | cut -f1) KB)"
  else
    echo "  WARNING: npx not found. Skipping .crx generation."
  fi
fi

step "Build complete. Output in $PKGDIR/"
ls -lh "$PKGDIR" | tail -n +2