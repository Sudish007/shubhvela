<#
.SYNOPSIS
  Builds a signed release APK of Shubhvela from the checked-in android/ folder.

.DESCRIPTION
  scripts/build-apk.ps1 -Abi <arm64-v8a|x86_64> -Version <x.y.z> [-ScreenshotMode]

  - refuses to run below 4 GB free on C: (exit 2) and prints the reclaimable list
  - reads release/KEYSTORE-INFO.txt and exports ORG_GRADLE_PROJECT_SHUBHVELA_* for the
    Gradle child process only (never on the command line, never printed)
  - -ScreenshotMode sets EXPO_PUBLIC_SCREENSHOT_MODE=1 so the bundle includes the
    shubhvela://dev/state seeding route (emulator builds only)
  - runs gradlew.bat assembleRelease in the FOREGROUND with output in android/build-run.log
  - copies the APK to release/Shubhvela-<version>-<arm64|x86_64>.apk
  - prints only the 'package:' line of aapt dump badging and the 'Verified' lines of apksigner
  - deletes android/app/build and android/app/.cxx afterwards (disk is tight)

  Exit codes: 0 ok, 1 build/verify failure, 2 disk check failed, 3 bad arguments.
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet('arm64-v8a', 'x86_64')][string]$Abi,
  [Parameter(Mandatory = $true)][string]$Version,
  [switch]$ScreenshotMode
)

$ErrorActionPreference = 'Stop'
$Root = 'c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela'
$AndroidDir = Join-Path $Root 'app/android'
$ReleaseDir = Join-Path $Root 'release'
$InfoFile = Join-Path $ReleaseDir 'KEYSTORE-INFO.txt'
$BuildTools = Join-Path $env:LOCALAPPDATA 'Android/Sdk/build-tools/36.0.0'
$MinFreeGB = 4

if ($Version -notmatch '^\d+\.\d+\.\d+$') { Write-Error "Version must look like 0.1.0 (got '$Version')"; exit 3 }

# ---- 1. disk check -------------------------------------------------------------
$freeGB = [math]::Round((Get-PSDrive C).Free / 1GB, 2)
Write-Host ("Disk free on C: {0} GB" -f $freeGB)
if ($freeGB -lt $MinFreeGB) {
  Write-Host "Refusing to build: less than $MinFreeGB GB free. Reclaimable without touching other projects:"
  Write-Host "  npm cache clean --force            (~0.7 GB)"
  Write-Host "  old files in $env:TEMP             (~0.2 GB)"
  Write-Host "Owner-only candidates:"
  Write-Host "  $env:USERPROFILE\.gradle\caches    (~4 GB, rebuilds itself)"
  Write-Host "  $env:LOCALAPPDATA\ms-playwright    (~1.4 GB, needed again in Phase D)"
  exit 2
}

# ---- 2. version check ----------------------------------------------------------
$appJson = Get-Content (Join-Path $Root 'app/app.json') -Raw | ConvertFrom-Json
if ($appJson.expo.version -ne $Version) {
  Write-Error "app/app.json expo.version is '$($appJson.expo.version)' but -Version is '$Version'"; exit 3
}
$gradleText = Get-Content (Join-Path $AndroidDir 'app/build.gradle') -Raw
if ($gradleText -notmatch ('versionName "' + [regex]::Escape($Version) + '"')) {
  Write-Error "android/app/build.gradle versionName does not equal '$Version'"; exit 3
}

# ---- 3. signing (env for the child process only) --------------------------------
$signed = $false
if (Test-Path $InfoFile) {
  $info = @{}
  foreach ($line in Get-Content $InfoFile) {
    if ($line -match '^\s*([^:]+?)\s*:\s*(.*)$') { $info[$Matches[1].Trim()] = $Matches[2].Trim() }
  }
  $storeRel = $info['keystore']
  $storeAbs = if ([System.IO.Path]::IsPathRooted($storeRel)) { $storeRel } else { Join-Path $Root $storeRel }
  if ((Test-Path $storeAbs) -and $info['password'] -and $info['alias']) {
    $env:ORG_GRADLE_PROJECT_SHUBHVELA_STORE_FILE = $storeAbs
    $env:ORG_GRADLE_PROJECT_SHUBHVELA_STORE_PASSWORD = $info['password']
    $env:ORG_GRADLE_PROJECT_SHUBHVELA_KEY_ALIAS = $info['alias']
    $env:ORG_GRADLE_PROJECT_SHUBHVELA_KEY_PASSWORD = if ($info['key password']) { $info['key password'] } else { $info['password'] }
    $signed = $true
    Write-Host "Signing: release keystore (alias $($info['alias']))"
  }
}
if (-not $signed) { Write-Host "Signing: release/KEYSTORE-INFO.txt not usable - Gradle falls back to the debug keystore" }

if ($ScreenshotMode) { $env:EXPO_PUBLIC_SCREENSHOT_MODE = '1'; Write-Host "Screenshot mode: ON (EXPO_PUBLIC_SCREENSHOT_MODE=1)" }
else { Remove-Item Env:EXPO_PUBLIC_SCREENSHOT_MODE -ErrorAction SilentlyContinue }

# ---- 4. gradle (foreground) ----------------------------------------------------
$log = Join-Path $AndroidDir 'build-run.log'
Push-Location $AndroidDir
try {
  Write-Host "Running gradlew.bat assembleRelease -PreactNativeArchitectures=$Abi (log: $log)"
  $t0 = Get-Date
  & .\gradlew.bat assembleRelease "-PreactNativeArchitectures=$Abi" --max-workers=2 --console=plain *> $log
  $gradleExit = $LASTEXITCODE
  Write-Host ("Gradle finished in {0:N0} s with exit code {1}" -f ((Get-Date) - $t0).TotalSeconds, $gradleExit)
}
finally {
  Pop-Location
  foreach ($n in 'ORG_GRADLE_PROJECT_SHUBHVELA_STORE_FILE', 'ORG_GRADLE_PROJECT_SHUBHVELA_STORE_PASSWORD', 'ORG_GRADLE_PROJECT_SHUBHVELA_KEY_ALIAS', 'ORG_GRADLE_PROJECT_SHUBHVELA_KEY_PASSWORD') {
    Remove-Item ("Env:" + $n) -ErrorAction SilentlyContinue
  }
}
if ($gradleExit -ne 0) {
  Write-Host "BUILD FAILED. Last lines of the log:"
  Get-Content $log -Tail 40
  Select-String -Path $log -Pattern '^e: ' | Select-Object -First 20 | ForEach-Object { $_.Line }
  exit 1
}

# ---- 5. copy + verify ----------------------------------------------------------
$outDir = Join-Path $AndroidDir 'app/build/outputs/apk/release'
$apk = Get-ChildItem $outDir -Filter '*.apk' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $apk) { Write-Error "No APK found under $outDir"; exit 1 }
$abiTag = if ($Abi -eq 'arm64-v8a') { 'arm64' } else { 'x86_64' }
$dest = Join-Path $ReleaseDir ("Shubhvela-{0}-{1}.apk" -f $Version, $abiTag)
New-Item -ItemType Directory -Force -Path $ReleaseDir | Out-Null
Copy-Item -Force $apk.FullName $dest
Write-Host ("APK: {0} ({1:N1} MB)" -f $dest, ((Get-Item $dest).Length / 1MB))

$aapt = Join-Path $BuildTools 'aapt.exe'
$apksigner = Join-Path $BuildTools 'apksigner.bat'
if (Test-Path $aapt) {
  & $aapt dump badging $dest 2>&1 | Select-String -Pattern '^package:|^sdkVersion|^targetSdkVersion|^native-code' | ForEach-Object { $_.Line }
} else { Write-Host "aapt not found at $aapt (badging skipped)" }
if (Test-Path $apksigner) {
  cmd /c """$apksigner"" verify --verbose ""$dest"" 2>&1" | Select-String -Pattern '^Verifie' | ForEach-Object { $_.Line }
} else { Write-Host "apksigner not found at $apksigner (signature check skipped)" }

# ---- 6. clean up build dirs (disk) --------------------------------------------
foreach ($d in 'app/build', 'app/.cxx') {
  $p = Join-Path $AndroidDir $d
  if (Test-Path $p) { cmd /c "rmdir /s /q ""$p""" | Out-Null }
}
Write-Host ("Disk free on C: {0} GB" -f [math]::Round((Get-PSDrive C).Free / 1GB, 2))
exit 0
