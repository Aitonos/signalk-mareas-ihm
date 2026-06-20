# Re-master alarm voice OGG files for maximum perceived loudness on
# peak-limited speakers (cheap USB DACs / built-in speakers).
#
# Default mode (-Mode Loudnorm): aggressive loudness normalization via
# ffmpeg's `loudnorm` filter targeting -9 LUFS integrated with -1 dBFS
# true peak. Result: peaks have 1 dB digital headroom (slider amplification
# can push slightly further before clipping) AND the perceived loudness
# is ~6-8 dB above the originals because dynamic range is compressed.
#
# Alternative (-Mode Attenuate): simple -6 dB attenuation. Cleaner, no
# dynamic range tampering, gives slider room to amplify back up. Choose
# this if loudnorm output sounds artificial.
#
# Restore mode (-Mode Restore): copy originals from backup over current.
#
# WORK FLOW:
#   1. Backs up originals to OGG Voices/_orig_before_remaster/ (one time).
#   2. Processes each .ogg in OGG Voices/ via ffmpeg.
#   3. Writes new versions to OGG Voices/ AND dist/sounds/ (so deploy
#      ships them without a rebuild step).
#   4. Run .\deploy.ps1 -Restart after to push to Pi.
#
# REQUIREMENTS:
#   - ffmpeg.exe in PATH (winget install Gyan.FFmpeg, or scoop install ffmpeg)
#
# ASCII only - PS 5.1 reads .ps1 as Windows-1252.

[CmdletBinding()]
param(
    [ValidateSet("Loudnorm", "Attenuate", "Restore")]
    [string]$Mode = "Loudnorm"
)

$ErrorActionPreference = "Stop"

$srcDir   = "OGG Voices"
$distDir  = "dist/sounds"
$backupDir = Join-Path $srcDir "_orig_before_remaster"

if (-not (Test-Path $srcDir)) {
    Write-Host "ERROR: '$srcDir' not found. Run from project root." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path $distDir)) {
    Write-Host "ERROR: '$distDir' not found. Run from project root." -ForegroundColor Red
    exit 1
}

# ---- Restore mode: copy backup back over working files ----
if ($Mode -eq "Restore") {
    if (-not (Test-Path $backupDir)) {
        Write-Host "ERROR: no backup found at '$backupDir'. Nothing to restore." -ForegroundColor Red
        exit 1
    }
    Write-Host "Restoring originals from $backupDir ..." -ForegroundColor Cyan
    Get-ChildItem $backupDir -Filter "*.ogg" | ForEach-Object {
        $f = $_.Name
        Copy-Item -Force (Join-Path $backupDir $f) (Join-Path $srcDir $f)
        Copy-Item -Force (Join-Path $backupDir $f) (Join-Path $distDir $f)
        Write-Host "  restored $f"
    }
    Write-Host "DONE. Run .\deploy.ps1 -Restart to push to Pi." -ForegroundColor Green
    exit 0
}

# ---- ffmpeg check ----
$ffmpegCmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
if (-not $ffmpegCmd) {
    Write-Host "ERROR: ffmpeg.exe not in PATH." -ForegroundColor Red
    Write-Host "Install with one of:" -ForegroundColor Yellow
    Write-Host "  winget install Gyan.FFmpeg"
    Write-Host "  scoop install ffmpeg"
    Write-Host "  choco install ffmpeg"
    exit 1
}
Write-Host "ffmpeg: $($ffmpegCmd.Source)" -ForegroundColor DarkGray

# ---- backup originals (one time) ----
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    Write-Host "Backing up originals to $backupDir ..." -ForegroundColor Cyan
    Get-ChildItem $srcDir -Filter "*.ogg" | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $backupDir $_.Name)
        Write-Host "  saved $($_.Name)"
    }
} else {
    Write-Host "Backup already exists at $backupDir (skipping)." -ForegroundColor DarkGray
}

# ---- ffmpeg filter selection ----
if ($Mode -eq "Loudnorm") {
    # NOTE: original "Loudnorm" name kept for CLI compat, but the actual
    # filter chain is now hard-gain + peak limiter, which gives a much
    # bigger perceptual boost on peak-limited speakers (cheap USB DACs).
    # loudnorm single-pass was conservative and barely lifted RMS.
    #
    # volume=18dB: linear +18 dB gain (factor ~8)
    # alimiter limit=0.95: peak ceiling -0.45 dBFS, attack 5ms / release 50ms
    # Net result on speech: RMS rises ~+13-15 dB, peaks clamped just under 0,
    # dynamic range heavily compressed. Voice sounds dense, almost shouty —
    # which is what we want for an emergency alarm on a peak-limited speaker.
    $filter = "volume=18dB,alimiter=level_in=1:level_out=1:limit=0.95:attack=5:release=50"
    Write-Host "Mode: Loudnorm-Hammer (+18 dB hard gain, peak-limited)" -ForegroundColor Cyan
} else {
    # Simple -6 dB attenuation (factor 0.5).
    $filter = "volume=0.5"
    Write-Host "Mode: Attenuate (-6 dB)" -ForegroundColor Cyan
}

# ---- process each OGG from BACKUP (so we re-master from clean source
#      every time, never from an already-processed file) ----
$files = Get-ChildItem $backupDir -Filter "*.ogg"
if ($files.Count -eq 0) {
    Write-Host "ERROR: no .ogg files in backup. Aborting." -ForegroundColor Red
    exit 1
}

$tmpDir = Join-Path $env:TEMP "ihm-remaster-ogg"
if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force }
New-Item -ItemType Directory -Path $tmpDir | Out-Null

foreach ($f in $files) {
    $srcFile = $f.FullName
    $output  = Join-Path $tmpDir $f.Name
    Write-Host "Processing $($f.Name) ..." -NoNewline
    & ffmpeg -y -hide_banner -loglevel error -i $srcFile -af $filter -c:a libvorbis -q:a 5 $output
    if ($LASTEXITCODE -ne 0) {
        Write-Host " FAILED (ffmpeg exit $LASTEXITCODE)" -ForegroundColor Red
        exit 1
    }
    Copy-Item -Force $output (Join-Path $srcDir $f.Name)
    Copy-Item -Force $output (Join-Path $distDir $f.Name)
    Write-Host " ok" -ForegroundColor Green
}

Remove-Item $tmpDir -Recurse -Force

Write-Host ""
Write-Host "DONE. $($files.Count) files re-mastered." -ForegroundColor Green
Write-Host "Originals preserved at $backupDir (use -Mode Restore to revert)." -ForegroundColor DarkGray
Write-Host "Next: .\deploy.ps1 -Restart" -ForegroundColor Yellow
