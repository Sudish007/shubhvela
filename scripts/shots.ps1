<#
.SYNOPSIS
  Takes emulator screenshots of Shubhvela screens for the phase audit.

.DESCRIPTION
  scripts/shots.ps1 -Phase <a|b|c|d> -Screens <route,route,...> [-Langs en,hi,bho] [-Themes light,dark]
                    [-Density 443] [-FontScale 1.0] [-Scrolled]

  For every screen x language x theme it:
    1. opens shubhvela://dev/state?lang=..&theme=..&screen=..&sample=1&font=.. (screenshot build only)
    2. collapses the status bar, waits, screencap -p on the device, adb pull (never exec-out through PowerShell)
    3. shrinks the PNG to <= 1920 px per side (node scripts/shrink-png.mjs)
    4. dumps the UI hierarchy (uiautomator) next to the PNG for scripts/audit-ui-dump.mjs
  Output: .agents/tasks/v1-build/shots/phase-<Phase>/<screen>-<lang>-<theme>[-<variant>].png (+ .ui.xml)

  -Density 443 = 390 dp wide on pixel_6; 480 = 360 dp; omit for the default 411 dp.
  Exit codes: 0 ok, 1 failure, 3 bad arguments.
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet('a', 'b', 'c', 'd')][string]$Phase,
  [Parameter(Mandatory = $true)][string[]]$Screens,
  [string[]]$Langs = @('en', 'hi', 'bho'),
  [string[]]$Themes = @('light', 'dark'),
  [int]$Density = 0,
  [string]$FontScale = '1.0',
  [switch]$Scrolled
)

$ErrorActionPreference = 'Stop'
$Root = 'c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela'
$Adb = Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe'
$OutDir = Join-Path $Root (".agents/tasks/v1-build/shots/phase-" + $Phase)
$Package = 'com.shubhvela.app'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$Screens = $Screens | ForEach-Object { $_ -split ',' } | Where-Object { $_ }
$Langs = $Langs | ForEach-Object { $_ -split ',' } | Where-Object { $_ }
$Themes = $Themes | ForEach-Object { $_ -split ',' } | Where-Object { $_ }

$state = (& $Adb get-state 2>$null | Out-String).Trim()
if ($state -ne 'device') { Write-Error "No emulator/device attached (adb get-state = '$state')"; exit 1 }

if ($Density -gt 0) { & $Adb shell wm density $Density | Out-Null } else { & $Adb shell wm density reset | Out-Null }
& $Adb shell settings put system font_scale $FontScale | Out-Null
Start-Sleep -Seconds 2

$variant = ''
if ($Density -eq 443) { $variant += '-390' } elseif ($Density -eq 480) { $variant += '-360' } elseif ($Density -gt 0) { $variant += "-d$Density" }
if ($FontScale -ne '1.0') { $variant += ('-f' + ($FontScale -replace '\.', '')) }
if ($Scrolled) { $variant += '-scrolled' }

$count = 0
foreach ($screen in $Screens) {
  foreach ($lang in $Langs) {
    foreach ($theme in $Themes) {
      $safeScreen = ($screen -replace '[^A-Za-z0-9_-]', '_')
      $name = "$safeScreen-$lang-$theme$variant"
      $url = "shubhvela://dev/state?lang=$lang&theme=$theme&screen=$([uri]::EscapeDataString($screen))&sample=1&font=$FontScale"
      & $Adb shell am start -W -a android.intent.action.VIEW -d "'$url'" $Package | Out-Null
      Start-Sleep -Seconds 3
      if ($Scrolled) { & $Adb shell input swipe 540 1800 540 600 300 | Out-Null; Start-Sleep -Seconds 1 }
      & $Adb shell cmd statusbar collapse | Out-Null
      Start-Sleep -Milliseconds 800
      & $Adb shell screencap -p /sdcard/s.png | Out-Null
      $png = Join-Path $OutDir "$name.png"
      & $Adb pull /sdcard/s.png $png | Out-Null
      & $Adb shell uiautomator dump /sdcard/ui.xml | Out-Null
      & $Adb pull /sdcard/ui.xml (Join-Path $OutDir "$name.ui.xml") | Out-Null
      node (Join-Path $Root 'scripts/shrink-png.mjs') $png | Out-Null
      Write-Host "shot: $name.png"
      $count++
    }
  }
}

& $Adb shell wm density reset | Out-Null
& $Adb shell settings put system font_scale 1.0 | Out-Null
Write-Host "$count screenshots written to $OutDir"
exit 0
