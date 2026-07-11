# Boxing Extension — Build & Package Script (v3.6.5+)
# No hardcoded paths. Works on any machine: CI/CD, local dev, or cross-platform.
#
# Usage:
#   powershell -File tools/build.ps1              # create unsigned .zip
#   powershell -File tools/build.ps1 -Crx          # create .crx for Chromium (needs .pem key)
#   powershell -File tools/build.ps1 -Firefox      # create Firefox-unsigned .zip
#   powershell -File tools/build.ps1 -Clean        # remove build artifacts
#
# Output lands in ./package/ directory (gitignored).

param(
  [switch]$Crx,
  [switch]$Firefox,
  [switch]$Clean,
  [string]$OutDir = "package"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

function Write-Step { param($msg) Write-Host "==> $msg" -ForegroundColor Cyan }

# ── Clean ───────────────────────────────────────
if ($Clean) {
  Write-Step "Cleaning build artifacts..."
  if (Test-Path "$Root\$OutDir") {
    Remove-Item -Recurse -Force "$Root\$OutDir"
  }
  Remove-Item -Force "$Root\*.crx", "$Root\*.zip", "$Root\*.xpi" -ErrorAction SilentlyContinue
  Write-Host "  Clean complete."
  return
}

# ── Validate project ────────────────────────────
$Manifest = "$Root\manifest.json"
if (!(Test-Path $Manifest)) { throw "manifest.json not found — are you running from boxing root?" }
$ManifestData = Get-Content $Manifest -Raw | ConvertFrom-Json
$Version = $ManifestData.version
$Name = $ManifestData.name

Write-Step "Building $Name v$Version"

# ── Prepare output ──────────────────────────────
$PackageDir = "$Root\$OutDir"
if (!(Test-Path $PackageDir)) { New-Item -ItemType Directory -Force $PackageDir | Out-Null }

# ── Source files (exclude dev-only + build artifacts) ──
$Exclude = @(
  '.git', '.gitignore', '.gitattributes',
  'node_modules', '.vscode', '.idea',
  '.codex', '.omx', '.codegraph',
  $OutDir, 'tools',
  'META-INF', '_metadata',
  '*.pem', '*.crx', '*.zip', '*.xpi',
  'debug_*.png', 'debug_*.jpg', '.DS_Store',
  '*.tmp', '*.log', 'tmp',
  'fonts', 'images'  # legacy junk
)

# Source file roots per extension manifest
$RequiredDirs = @(
  '_locales', 'ntp', 'popup', 'icons',
  'docs'   # optional but kept for reference
)
$RequiredFiles = @(
  'manifest.json', 'background.js',
  'LICENSE', 'README.md', 'agent.md'
)

# ── Chrome/Chromium .zip (unsigned) ─────────────
$ZipName = "$Name-v$Version-chromium.zip"
$ZipPath = "$PackageDir\$ZipName"

Write-Step "Zipping Chromium package..."
# 7z if available (much faster), else Compress-Archive
if (Get-Command "7z" -ErrorAction SilentlyContinue) {
  $prev = Get-Location
  Set-Location $Root
  $fileList = (Get-ChildItem -Recurse -File | Where-Object { 
    $rel = $_.FullName.Substring($Root.Length + 1).Replace('\','/')
    -not ($Exclude | ForEach-Object { $rel -like $_ -or $rel.StartsWith($_) })
  }) -join ' '
  cmd /c "7z a -tzip `"$ZipPath`" $fileList 2>&1" | Out-Null
  Set-Location $prev
} else {
  # Fallback: Compress-Archive (slower but universal)
  $tmpDir = "$PackageDir\.tmp-chromium"
  if (Test-Path $tmpDir) { Remove-Item -Recurse -Force $tmpDir }
  New-Item -ItemType Directory -Force $tmpDir | Out-Null
  Get-ChildItem -Recurse -File -Path $Root | Where-Object {
    $rel = $_.FullName.Substring($Root.Length + 1).Replace('\','/')
    $skip = $false
    foreach ($pat in $Exclude) { if ($rel -like $pat -or $rel.StartsWith($pat)) { $skip = $true; break } }
    return -not $skip
  } | ForEach-Object {
    $dest = "$tmpDir\$($_.FullName.Substring($Root.Length + 1))"
    $destDir = Split-Path $dest -Parent
    if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Force $destDir | Out-Null }
    Copy-Item $_.FullName $dest
  }
  Compress-Archive -Path "$tmpDir\*" -DestinationPath $ZipPath -Force
  Remove-Item -Recurse -Force $tmpDir
}
Write-Host "  $ZipPath ($((Get-Item $ZipPath).Length/1KB) KB)"

# ── Firefox .zip (unsigned, no META-INF) ────────
if ($Firefox) {
  $FxZip = "$Name-v$Version-firefox.zip"
  $FxZipPath = "$PackageDir\$FxZip"
  Write-Step "Zipping Firefox package..."
  # Firefox uses same file set as Chromium; no META-INF signing
  if (Get-Command "7z" -ErrorAction SilentlyContinue) {
    $prev = Get-Location; Set-Location $Root
    $fileList = (Get-ChildItem -Recurse -File | Where-Object { 
      $rel = $_.FullName.Substring($Root.Length + 1).Replace('\','/')
      -not ($Exclude | ForEach-Object { $rel -like $_ -or $rel.StartsWith($_) })
    }) -join ' '
    cmd /c "7z a -tzip `"$FxZipPath`" $fileList 2>&1" | Out-Null
    Set-Location $prev
  } else {
    Copy-Item $ZipPath $FxZipPath
  }
  Write-Host "  $FxZipPath ($((Get-Item $FxZipPath).Length/1KB) KB)"
}

# ── Chromium .crx (signed with .pem) ────────────
if ($Crx) {
  Write-Step "Creating CRX (Chromium signed package)..."
  $PemFile = Get-ChildItem "$Root\*.pem" -ErrorAction SilentlyContinue | Select-Object -First 1
  if (!$PemFile) {
    Write-Host "  WARNING: No .pem key found. Generating new one..."
    Write-Host "  Keep this .pem file SAFE — it's your extension identity key."
    # Generate via OpenSSL if available, else via Node.js
    if (Get-Command "openssl" -ErrorAction SilentlyContinue) {
      cmd /c "openssl genrsa -out `"$Root\boxing.pem`" 2048 2>&1" | Out-Null
      $PemFile = "$Root\boxing.pem"
    } elseif (Get-Command "node" -ErrorAction SilentlyContinue) {
      node -e "
        const crypto = require('crypto');
        const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
        require('fs').writeFileSync(process.argv[1], privateKey.export({ type: 'pkcs1', format: 'pem' }));
      " "$Root\boxing.pem"
      $PemFile = "$Root\boxing.pem"
    } else {
      throw "Cannot generate .pem — install OpenSSL or Node.js"
    }
  }
  Write-Host "  Using key: $PemFile"

  # Use Chrome's built-in packing via chrome.exe --pack-extension
  $ChromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "C:\Program Files\Chromium\Application\chrome.exe"
  )
  $ChromeExe = $ChromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($ChromeExe) {
    $CrxFile = "$PackageDir\$Name-v$Version.crx"
    Write-Host "  Packing via Chrome..."
    $tmpDirCrx = "$PackageDir\.tmp-crx-source"
    if (Test-Path $tmpDirCrx) { Remove-Item -Recurse -Force $tmpDirCrx }
    New-Item -ItemType Directory -Force $tmpDirCrx | Out-Null
    Get-ChildItem -Recurse -File -Path $Root | Where-Object {
      $rel = $_.FullName.Substring($Root.Length + 1).Replace('\','/')
      $skip = $false
      foreach ($pat in $Exclude) { if ($rel -like $pat -or $rel.StartsWith($pat)) { $skip = $true; break } }
      return -not $skip
    } | ForEach-Object {
      $dest = "$tmpDirCrx\$($_.FullName.Substring($Root.Length + 1))"
      $destDir = Split-Path $dest -Parent
      if (!(Test-Path $destDir)) { New-Item -ItemType Directory -Force $destDir | Out-Null }
      Copy-Item $_.FullName $dest
    }
    & $ChromeExe --pack-extension="$tmpDirCrx" --pack-extension-key="$PemFile" --no-message-box 2>&1 | Out-Null
    $genCrx = "$tmpDirCrx.crx"
    if (Test-Path $genCrx) {
      Move-Item $genCrx $CrxFile -Force
      Write-Host "  $CrxFile ($((Get-Item $CrxFile).Length/1KB) KB)"
    } else {
      Write-Host "  WARNING: Chrome CRX generation failed. .zip is sufficient for dev install."
    }
    Remove-Item -Recurse -Force $tmpDirCrx -ErrorAction SilentlyContinue
  } else {
    Write-Host "  WARNING: Chrome not found. Skipping .crx generation."
    Write-Host "  To install: open chrome://extensions, enable Developer mode, Load unpacked → select $Root"
  }
}

Write-Step "Build complete. Output in $PackageDir\"
Get-ChildItem $PackageDir | ForEach-Object { Write-Host "  $($_.Name) ($([math]::Round($_.Length/1KB,1)) KB)" }
