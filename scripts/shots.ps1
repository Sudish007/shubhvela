<#
.SYNOPSIS
  Takes emulator screenshots of Shubhvela screens for the phase audit.

.DESCRIPTION
  scripts/shots.ps1 -Phase <a|b|c|d> -Screens <spec,spec,...> [-Langs en,hi,bho] [-Themes light,dark]
                    [-Density 443] [-FontScale 1.0] [-Scrolled] [-Variant <suffix>] [-Extra 'session=4&pro=1'] [-KeepRaw]
                    [-NavMode <gesture|3button>] [-SubDir navbar]

  A screen spec is  <label>=<route>[;style=<north|south|east>][;type=<resource-id>:<ascii text>][;tap=<resource-id>[,<resource-id>...]]
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
  -NavMode (c06, DEV-1) switches the system navigation (cmd overlay enable-exclusive --category ...navbar.gestural |
  ...navbar.threebutton), waits for settings secure navigation_mode (2 | 0) and adds the suffix -gest | -3btn. Every shot
  also writes <name>.meta.json with the navigation-bar rectangle from dumpsys window (InsetsSource type=navigationBars
  frame) so scripts/audit-ui-dump.mjs can check that no tappable control lies under the bar. -SubDir writes under
  shots/phase-<Phase>/<SubDir>/.
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
  [switch]$BottomOnly,
  # Extra dev/state query parameters appended to every link, e.g. 'session=4' (ads shown) or 'pro=1' (B08 Pro variants).
  [string]$Extra = '',
  # Number of swipes for -Scrolled (1 = one screen; Today's last card needs ~4).
  [int]$ScrollCount = 1,
  # c-ship: keep the unshrunk 1080x2400 screencap under <OutDir>/raw/ (Play listing source, D04) before shrinking.
  [switch]$KeepRaw,
  # c06 (DEV-1): system navigation mode for this batch; '' leaves the emulator as it is (no suffix, meta still written).
  [ValidateSet('', 'gesture', '3button')][string]$NavMode = '',
  # c06: sub-folder under shots/phase-<Phase>/ (e.g. navbar).
  [string]$SubDir = ''
)

$ErrorActionPreference = 'Stop'
$Root = 'c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela'
$Adb = Join-Path $env:LOCALAPPDATA 'Android/Sdk/platform-tools/adb.exe'
$OutDir = Join-Path $Root (".agents/tasks/v1-build/shots/phase-" + $Phase)
if ($SubDir) { $OutDir = Join-Path $OutDir $SubDir }
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

function Wait-ForId([string]$xml, [string]$id, [int]$maxSeconds) {
  $deadline = (Get-Date).AddSeconds($maxSeconds)
  while (-not ($xml -match ('resource-id="' + [regex]::Escape($id) + '"')) -and (Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    $xml = Get-UiDump
  }
  return $xml
}

# Text nodes + bounds only: the test banner's WebView nodes change their content-desc between dumps and would never
# let the "scrolled to the end" comparison settle.
function Scroll-Signature([string]$xml) {
  return (([regex]::Matches($xml, 'text="[^"]+"[^>]*bounds="[^"]+"') | ForEach-Object { $_.Value }) -join '|')
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

# c06 (DEV-1): navigation mode. `enable-exclusive --category` is what Settings uses; enabling one overlay and disabling
# the other separately left navigation_mode unchanged on the API 34 image (observed 2026-10-29).
if ($NavMode) {
  $overlay = if ($NavMode -eq '3button') { 'com.android.internal.systemui.navbar.threebutton' } else { 'com.android.internal.systemui.navbar.gestural' }
  $wantMode = if ($NavMode -eq '3button') { '0' } else { '2' }
  Adb-Quiet @('shell', 'cmd', 'overlay', 'enable-exclusive', '--category', $overlay) | Out-Null
  $deadline = (Get-Date).AddSeconds(20)
  do { Start-Sleep -Seconds 2; $mode = (Adb-Quiet @('shell', 'settings', 'get', 'secure', 'navigation_mode')).Trim() } while ($mode -ne $wantMode -and (Get-Date) -lt $deadline)
  if ($mode -ne $wantMode) { Write-Error "navigation_mode is '$mode', wanted '$wantMode' ($NavMode)"; exit 1 }
  Write-Host "Navigation mode: $NavMode (navigation_mode=$mode)"
}

# Navigation-bar rectangle in px from the window manager (frame of the navigationBars inset source) + the real density.
function Get-NavBarMeta {
  $dump = Adb-Quiet @('shell', 'dumpsys', 'window')
  $m = [regex]::Match($dump, 'type=navigationBars frame=\[(\d+),(\d+)\]\[(\d+),(\d+)\]')
  $rect = if ($m.Success) { @([int]$m.Groups[1].Value, [int]$m.Groups[2].Value, [int]$m.Groups[3].Value, [int]$m.Groups[4].Value) } else { $null }
  $mode = (Adb-Quiet @('shell', 'settings', 'get', 'secure', 'navigation_mode')).Trim()
  $dens = Adb-Quiet @('shell', 'wm', 'density')
  $dm = [regex]::Match($dens, 'Override density: (\d+)')
  if (-not $dm.Success) { $dm = [regex]::Match($dens, 'Physical density: (\d+)') }
  return @{ navBar = $rect; navigationMode = $mode; navMode = $(if ($mode -eq '0') { '3button' } elseif ($mode -eq '2') { 'gesture' } else { "mode$mode" }); density = $(if ($dm.Success) { [int]$dm.Groups[1].Value } else { 0 }); fontScale = $FontScale }
}

$suffix = ''
if ($Density -eq 443) { $suffix += '-390' } elseif ($Density -eq 480) { $suffix += '-360' } elseif ($Density -gt 0) { $suffix += "-d$Density" }
if ($FontScale -ne '1.0') { $suffix += ('-f' + ($FontScale -replace '\.', '')) }
if ($Scrolled) { $suffix += '-scrolled' }
if ($NavMode -eq '3button') { $suffix += '-3btn' } elseif ($NavMode -eq 'gesture') { $suffix += '-gest' }
if ($Variant) { $suffix += "-$Variant" }

$count = 0
foreach ($spec in $Screens) {
  $parts = $spec -split ';'
  $head = $parts[0]
  if ($head -notmatch '^([A-Za-z0-9_-]+)=(.+)$') { Write-Error "Bad screen spec '$spec' (want label=route[;style=..][;tap=..])"; exit 3 }
  $label = $Matches[1]; $route = $Matches[2]
  $style = ''; $taps = @(); $hscroll = ''; $scrollTo = ''; $typeId = ''; $typeText = ''
  foreach ($p in $parts[1..($parts.Count - 1)]) {
    if ($p -match '^style=(north|south|east)$') { $style = $Matches[1] }
    elseif ($p -match '^tap=(.+)$') { $taps = $Matches[1] -split ',' }
    # type=<resource-id>:<text>: focus that text field and type the text (spaces allowed) before the taps run (c-fix:
    # the Prashna reading state needs a question in the field before `tap=prashna-cast`).
    elseif ($p -match '^type=([^:]+):(.+)$') { $typeId = $Matches[1]; $typeText = $Matches[2] }
    # scrollto=<resource-id>: scroll until that node is on screen (fully above the fixed chrome) but do NOT tap it (C05:
    # frame the "More from this chart" card without opening a row).
    elseif ($p -match '^scrollto=(.+)$') { $scrollTo = $Matches[1] }
    # hscroll=<resource-id>: swipe that horizontal row to its end before tapping (off-screen chips, B08).
    elseif ($p -match '^hscroll=(.+)$') { $hscroll = $Matches[1] }
  }
  foreach ($lang in $Langs) {
    foreach ($theme in $Themes) {
      $name = "$label-$lang-$theme$suffix"
      # The emulator has exited by itself mid-batch (A13, B08): fail fast instead of looping on an absent device.
      if ((Adb-Quiet @('get-state')).Trim() -ne 'device') { Write-Error "Emulator gone before $name (adb get-state)"; exit 1 }
      $url = "shubhvela://dev/state?lang=$lang&theme=$theme&screen=$([uri]::EscapeDataString($route))&sample=1&font=$FontScale"
      if ($style) { $url += "&style=$style" }
      if ($Extra) { $url += "&$Extra" }
      # Cold start per shot: repeated deep links into a running app left Today stuck on its skeleton and ANR'd on the
      # emulator (A13); a fresh process is slower (~12 s to the full Today stack) but deterministic.
      # -S force-stops first; --activity-clear-task drops the task whose ROOT intent (an older deep link) Android would
      # otherwise replay as the launch intent, delivering the new link only via onNewIntent before JS listens.
      Adb-Quiet @('shell', 'am', 'start', '-S', '-W', '--activity-clear-task', '-a', 'android.intent.action.VIEW', '-d', "'$url'", $Package) | Out-Null
      Start-Sleep -Seconds 6
      $xml = Wait-Ready 60
      # Ads run: UMP consent + SDK init + the banner request take 10-15 s after the dev route (B08 logcat); on a
      # banner-bearing route wait for the strip so the shot and the M6 dump carry it (no-fill falls through after 40 s).
      if ($Extra -match 'session=' -and $route -match 'charts$|family$|muhurat$|match/result|festival|calendar|dasha-tree|ashtakavarga|kp$|vrat') { $xml = Wait-ForId $xml 'banner-strip' 40 }
      if ($hscroll) {
        # Wait-Ready can return while the previous screen is still up (no skeleton node on Charts): wait for the row itself.
        $xml = Wait-ForId $xml $hscroll 30
        $hm = [regex]::Match($xml, 'resource-id="' + [regex]::Escape($hscroll) + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
        if ($hm.Success) {
          $hy = [int](([int]$hm.Groups[2].Value + [int]$hm.Groups[4].Value) / 2)
          # Start 120 px inside the right edge: a touch within the system back-gesture inset (~22 dp) navigates back instead.
          Adb-Quiet @('shell', 'input', 'swipe', "$([int]$hm.Groups[3].Value - 120)", "$hy", "$([int]$hm.Groups[1].Value + 20)", "$hy", '400') | Out-Null
          Start-Sleep -Seconds 2
          $xml = Get-UiDump
        } else { Write-Host "  hscroll row '$hscroll' not found" }
      }
      if ($typeId) {
        $xml = Wait-ForId $xml $typeId 20
        if (Tap-Node $xml $typeId) {
          Start-Sleep -Seconds 1
          # `input text` takes no literal spaces: Android's shell expands %s to a space (ASCII text only).
          Adb-Quiet @('shell', 'input', 'text', ($typeText -replace ' ', '%s')) | Out-Null
          Start-Sleep -Seconds 1
          # Hide the soft keyboard so the taps below and the screenshot see the whole screen.
          Adb-Quiet @('shell', 'input', 'keyevent', 'KEYCODE_BACK') | Out-Null
          Start-Sleep -Seconds 1
          $xml = Get-UiDump
        }
      }
      $targets = @($taps)
      if ($scrollTo) { $targets = @($scrollTo) + $targets }
      foreach ($id in $targets) {
        # Give the screen time to render the target before scrolling for it (see the hscroll note above).
        if (-not $hscroll) { $xml = Wait-ForId $xml $id 20 }
        # Targets below the fold: scroll up to fourteen screens until the node is in the dump (Charts is ~10 screens long).
        $tries = 0
        while (-not ($xml -match ('resource-id="' + [regex]::Escape($id) + '"')) -and $tries -lt 14) {
          Adb-Quiet @('shell', 'input', 'swipe', '540', '1700', '540', '700', '300') | Out-Null
          Start-Sleep -Seconds 2
          $xml = Get-UiDump
          $tries++
        }
        # A target found but lying under the banner strip (which overlays the scroll view's bottom) would tap the ad
        # (B08: Chrome opened on the test banner): nudge it above the strip first.
        $nm = [regex]::Match($xml, 'resource-id="' + [regex]::Escape($id) + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
        $sm = [regex]::Match($xml, 'resource-id="banner-strip"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
        if ($nm.Success -and $sm.Success -and [int]$nm.Groups[4].Value -gt [int]$sm.Groups[2].Value - 10) {
          $dy = [int]$nm.Groups[4].Value - [int]$sm.Groups[2].Value + 200
          Adb-Quiet @('shell', 'input', 'swipe', '540', '1400', '540', "$(1400 - $dy)", '400') | Out-Null
          Start-Sleep -Seconds 2
          $xml = Get-UiDump
        }
        if ($id -eq $scrollTo) {
          # Bring the whole node (and ~1 row above it) into view: scroll so its top sits ~400 px below the screen top.
          $tm = [regex]::Match($xml, 'resource-id="' + [regex]::Escape($id) + '"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
          if ($tm.Success) {
            $dy = [math]::Min(1200, [int]$tm.Groups[2].Value - 400)
            if ([math]::Abs($dy) -gt 40) { Adb-Quiet @('shell', 'input', 'swipe', '540', '1400', '540', "$(1400 - $dy)", '400') | Out-Null; Start-Sleep -Seconds 2; $xml = Get-UiDump }
          }
          continue
        }
        if (Tap-Node $xml $id) { Start-Sleep -Seconds 2; $xml = Wait-Ready 20 }
      }
      if ($Scrolled) {
        for ($s = 0; $s -lt $ScrollCount; $s++) { Adb-Quiet @('shell', 'input', 'swipe', '540', '1800', '540', '600', '300') | Out-Null; Start-Sleep -Milliseconds 900 }
        Start-Sleep -Seconds 2
      }
      if (-not $BottomOnly) {
        Adb-Quiet @('shell', 'cmd', 'statusbar', 'collapse') | Out-Null
        Start-Sleep -Milliseconds 800
        Adb-Quiet @('shell', 'screencap', '-p', '/sdcard/s.png') | Out-Null
        $png = Join-Path $OutDir "$name.png"
        Adb-Quiet @('pull', '/sdcard/s.png', $png) | Out-Null
        $xml = Get-UiDump
        [IO.File]::WriteAllText((Join-Path $OutDir "$name.ui.xml"), $xml)
        # c06: the navigation-bar rectangle for the audit's "covered by the navigation bar" check.
        [IO.File]::WriteAllText((Join-Path $OutDir "$name.meta.json"), ((Get-NavBarMeta) | ConvertTo-Json -Compress))
        if ($KeepRaw) {
          $rawDir = Join-Path $OutDir 'raw'
          New-Item -ItemType Directory -Force -Path $rawDir | Out-Null
          Copy-Item -Force $png (Join-Path $rawDir "$name.png")
        }
        node (Join-Path $Root 'scripts/shrink-png.mjs') $png | Out-Null
        Write-Host "shot: $name.png"
      }
      # Full-scroll dump for the "covered" check (design.md 13: >= 16 dp clearance above the CTA / banner strip at full
      # scroll, M6). Swipe until the hierarchy stops changing (a 3-page PDF preview is ~15 screens long; cap 40).
      # c06: with -NavMode every screen gets the full-scroll dump, so the audit can check that the last rows of a plain
      # stack screen (Screen padding 16 + inset) end above the navigation bar too.
      if ($NavMode -or $xml -match 'resource-id="(screen-cta|banner-strip)"') {
        # Rounds of five fast flings, one dump per round (a dump costs ~5 s; the 42-window muhurat list is ~16 screens).
        $prev = ''; $cur = Scroll-Signature $xml
        for ($s = 0; $s -lt 12 -and $cur -ne $prev; $s++) {
          # Start above the banner strip (its top is >= 1778 px at 480 dpi): a fling that begins on the ad WebView is eaten by it.
          for ($k = 0; $k -lt 5; $k++) { Adb-Quiet @('shell', 'input', 'swipe', '540', '1600', '540', '200', '60') | Out-Null; Start-Sleep -Milliseconds 500 }
          Start-Sleep -Milliseconds 1200
          $prev = $cur; $cur = Scroll-Signature (Get-UiDump)
        }
        Start-Sleep -Seconds 1
        [IO.File]::WriteAllText((Join-Path $OutDir "$name.bottom.ui.xml"), (Get-UiDump))
        Write-Host "  bottom dump: $name.bottom.ui.xml ($s fling rounds)"
      }
      $count++
    }
  }
}

Adb-Quiet @('shell', 'wm', 'density', 'reset') | Out-Null
Adb-Quiet @('shell', 'settings', 'put', 'system', 'font_scale', '1.0') | Out-Null
Write-Host "$count screenshots written to $OutDir"
exit 0
