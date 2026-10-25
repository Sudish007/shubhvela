<#
.SYNOPSIS
  Takes emulator screenshots of Shubhvela screens for the phase audit.

.DESCRIPTION
  scripts/shots.ps1 -Phase <a|b|c|d> -Screens <spec,spec,...> [-Langs en,hi,bho] [-Themes light,dark]
                    [-Density 443] [-FontScale 1.0] [-Scrolled] [-Variant <suffix>]

  A screen spec is  <label>=<route>[;style=<north|south|east>][;tap=<resource-id>[,<resource-id>...]]
  e.g.  today=/(tabs)/today            charts-south=/(tabs)/charts;style=south
        today-panchang-sheet=/(tabs)/today;tap=panchang-pill
  (the comma inside tap= is only allowed when the spec list is passed as a PowerShell array, one spec per element).

  For every spec x language x theme it:
    1. opens shubhvela://dev/state?lang=..&theme=..&screen=..&sample=1&font=..[&style=..] (screenshot build only;
       `{self}` in the route becomes the seeded self profile id)
    2. waits until the UI hierarchy has no *-skeleton node (engine compute done; <= 40 s), taps the optional targets
       (centre of the node with that resource-id = React Native testID) and waits again
    3. collapses the status bar, screencap -p on the device, adb pull (never exec-out through PowerShell)
    4. shrinks the PNG to <= 1920 px per side (node scripts/shrink-png.mjs)
    5. dumps the UI hierarchy (uiautomator) next to the PNG for scripts/audit-ui-dump.mjs
  Output: .agents/tasks/v1-build/shots/phase-<Phase>/<label>-<lang>-<theme>[-<variant>].png (+ .ui.xml)

  -Density 443 = 390 dp wide on pixel_6; 480 = 360 dp; omit for the default 411 dp (variant suffix -412).
  Exit codes: 0 ok, 1 failure, 3 bad arguments.
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet('a', 'b', 'c', 'd')][string]$Phase,
  [Parameter(Mandatory = $true)][string[]]$Screens,
  [string[]]$Langs = @('en', 'hi', 'bho'),
  [string[]]$Themes = @('light', 'dark'),
  [int]$Density = 0,
  [string]$FontScale = '1.0',
  [switch]$Scrolled,
  [string]$Variant = '',
  [switch]$BottomOnly
)

$ErrorActionPreference = 'Stop'
$Root = 'c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela'
$Adb = Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe'
$OutDir = Join-Path $Root (".agents/tasks/v1-build/shots/phase-" + $Phase)
$Package = 'com.shubhvela.app'
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Specs may arrive as one comma-joined string (no tap lists) or as an array (tap lists allowed).
if ($Screens.Count -eq 1 -and $Screens[0] -notmatch 'tap=') { $Screens = $Screens[0] -split ',' }
$Screens = $Screens | Where-Object { $_ }
$Langs = $Langs | ForEach-Object { $_ -split ',' } | Where-Object { $_ }
$Themes = $Themes | ForEach-Object { $_ -split ',' } | Where-Object { $_ }

function Adb-Quiet([string[]]$ArgList) {
  # adb writes warnings to stderr; under ErrorActionPreference=Stop that would abort, so route through cmd.
  $quoted = ($ArgList | ForEach-Object { if ($_ -match '[\s&|<>()''"]') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ } }) -join ' '
  return (cmd /c """$Adb"" $quoted 2>nul" | Out-String)
}

function Get-UiDump {
  Adb-Quiet @('shell', 'uiautomator', 'dump', '/sdcard/ui.xml') | Out-Null
  return (Adb-Quiet @('shell', 'cat', '/sdcard/ui.xml'))
}

function Wait-Ready([int]$maxSeconds) {
  $deadline = (Get-Date).AddSeconds($maxSeconds)
  $xml = ''
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 4
    $xml = Get-UiDump
    $nodes = ([regex]::Matches($xml, '<node ')).Count
    if ($nodes -ge 12 -and $xml -notmatch 'resource-id="[^"]*-skeleton"') { return $xml }
  }
  Write-Host "  (still computing after $maxSeconds s; shooting anyway)"
  return $xml
}

function Tap-Node([string]$xml, [string]$id) {
  $m = [regex]::Match($xml, 'resource-id="' + [regex]::Escape($id) + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
  if (-not $m.Success) {
    # bounds may precede resource-id in the attribute order
    $m = [regex]::Match($xml, '<node [^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"[^>]*resource-id="' + [regex]::Escape($id) + '"')
  }
  if (-not $m.Success) { Write-Host "  tap target '$id' not found"; return $false }
  $x = [int](([int]$m.Groups[1].Value + [int]$m.Groups[3].Value) / 2)
  $y = [int](([int]$m.Groups[2].Value + [int]$m.Groups[4].Value) / 2)
  Adb-Quiet @('shell', 'input', 'tap', "$x", "$y") | Out-Null
  return $true
}

$state = (Adb-Quiet @('get-state')).Trim()
if ($state -ne 'device') { Write-Error "No emulator/device attached (adb get-state = '$state')"; exit 1 }

if ($Density -gt 0) { Adb-Quiet @('shell', 'wm', 'density', "$Density") | Out-Null } else { Adb-Quiet @('shell', 'wm', 'density', 'reset') | Out-Null }
Adb-Quiet @('shell', 'settings', 'put', 'system', 'font_scale', $FontScale) | Out-Null
Start-Sleep -Seconds 2

$suffix = ''
if ($Density -eq 443) { $suffix += '-390' } elseif ($Density -eq 480) { $suffix += '-360' } elseif ($Density -gt 0) { $suffix += "-d$Density" }
if ($FontScale -ne '1.0') { $suffix += ('-f' + ($FontScale -replace '\.', '')) }
if ($Scrolled) { $suffix += '-scrolled' }
if ($Variant) { $suffix += "-$Variant" }

$count = 0
foreach ($spec in $Screens) {
  $parts = $spec -split ';'
  $head = $parts[0]
  if ($head -notmatch '^([A-Za-z0-9_-]+)=(.+)$') { Write-Error "Bad screen spec '$spec' (want label=route[;style=..][;tap=..])"; exit 3 }
  $label = $Matches[1]; $route = $Matches[2]
  $style = ''; $taps = @()
  foreach ($p in $parts[1..($parts.Count - 1)]) {
    if ($p -match '^style=(north|south|east)$') { $style = $Matches[1] }
    elseif ($p -match '^tap=(.+)$') { $taps = $Matches[1] -split ',' }
  }
  foreach ($lang in $Langs) {
    foreach ($theme in $Themes) {
      $name = "$label-$lang-$theme$suffix"
      $url = "shubhvela://dev/state?lang=$lang&theme=$theme&screen=$([uri]::EscapeDataString($route))&sample=1&font=$FontScale"
      if ($style) { $url += "&style=$style" }
      # Cold start per shot: repeated deep links into a running app left Today stuck on its skeleton and ANR'd on the
      # emulator (A13); a fresh process is slower (~12 s to the full Today stack) but deterministic.
      # -S force-stops first; --activity-clear-task drops the task whose ROOT intent (an older deep link) Android would
      # otherwise replay as the launch intent, delivering the new link only via onNewIntent before JS listens.
      Adb-Quiet @('shell', 'am', 'start', '-S', '-W', '--activity-clear-task', '-a', 'android.intent.action.VIEW', '-d', "'$url'", $Package) | Out-Null
      Start-Sleep -Seconds 6
      $xml = Wait-Ready 60
      foreach ($id in $taps) {
        # Targets below the fold: scroll up to three screens until the node is in the dump.
        $tries = 0
        while (-not ($xml -match ('resource-id="' + [regex]::Escape($id) + '"')) -and $tries -lt 3) {
          Adb-Quiet @('shell', 'input', 'swipe', '540', '1700', '540', '700', '300') | Out-Null
          Start-Sleep -Seconds 2
          $xml = Get-UiDump
          $tries++
        }
        if (Tap-Node $xml $id) { Start-Sleep -Seconds 2; $xml = Wait-Ready 20 }
      }
      if ($Scrolled) { Adb-Quiet @('shell', 'input', 'swipe', '540', '1800', '540', '600', '300') | Out-Null; Start-Sleep -Seconds 2 }
      if (-not $BottomOnly) {
        Adb-Quiet @('shell', 'cmd', 'statusbar', 'collapse') | Out-Null
        Start-Sleep -Milliseconds 800
        Adb-Quiet @('shell', 'screencap', '-p', '/sdcard/s.png') | Out-Null
        $png = Join-Path $OutDir "$name.png"
        Adb-Quiet @('pull', '/sdcard/s.png', $png) | Out-Null
        $xml = Get-UiDump
        [IO.File]::WriteAllText((Join-Path $OutDir "$name.ui.xml"), $xml)
        node (Join-Path $Root 'scripts/shrink-png.mjs') $png | Out-Null
        Write-Host "shot: $name.png"
      }
      # Full-scroll dump for the "covered" check (design.md 13: >= 16 dp clearance above the CTA at full scroll).
      if ($xml -match 'resource-id="screen-cta"') {
        for ($s = 0; $s -lt 4; $s++) { Adb-Quiet @('shell', 'input', 'swipe', '540', '1700', '540', '500', '200') | Out-Null; Start-Sleep -Milliseconds 700 }
        Start-Sleep -Seconds 1
        [IO.File]::WriteAllText((Join-Path $OutDir "$name.bottom.ui.xml"), (Get-UiDump))
        Write-Host "  bottom dump: $name.bottom.ui.xml"
      }
      $count++
    }
  }
}

Adb-Quiet @('shell', 'wm', 'density', 'reset') | Out-Null
Adb-Quiet @('shell', 'settings', 'put', 'system', 'font_scale', '1.0') | Out-Null
Write-Host "$count screenshots written to $OutDir"
exit 0
