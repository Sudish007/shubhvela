<#
.SYNOPSIS
  Installs, boots or kills the Shubhvela test emulator (AVD shubhvela_test).

.DESCRIPTION
  scripts/emulator.ps1 -Install   installs the emulator package + system image and creates the AVD
  scripts/emulator.ps1 -Boot      boots the AVD headless-friendly, waits for sys.boot_completed,
                                  disables animations, resets font scale
  scripts/emulator.ps1 -Kill      adb emu kill

  Procedure from plan.md section 10. Install refuses below 4 GB free (exit 2).
  Exit codes: 0 ok, 1 failure, 2 disk check failed, 3 bad arguments.
#>
param(
  [switch]$Install,
  [switch]$Boot,
  [switch]$Kill
)

$ErrorActionPreference = 'Stop'
$Sdk = Join-Path $env:LOCALAPPDATA 'Android/Sdk'
$SdkManager = Join-Path $Sdk 'cmdline-tools/latest/bin/sdkmanager.bat'
$AvdManager = Join-Path $Sdk 'cmdline-tools/latest/bin/avdmanager.bat'
$EmulatorExe = Join-Path $Sdk 'emulator/emulator.exe'
$Adb = Join-Path $Sdk 'platform-tools/adb.exe'
$AvdName = 'shubhvela_test'
$Image = 'system-images;android-34;google_apis;x86_64'
$MinFreeGB = 4

if (-not ($Install -or $Boot -or $Kill)) { Write-Host "Use -Install, -Boot or -Kill"; exit 3 }

function Check-Disk {
  $freeGB = [math]::Round((Get-PSDrive C).Free / 1GB, 2)
  Write-Host ("Disk free on C: {0} GB" -f $freeGB)
  if ($freeGB -lt $MinFreeGB) {
    Write-Host "Refusing: less than $MinFreeGB GB free (emulator 0.4 GB + image 1.4 GB + AVD ~1.5 GB)."
    Write-Host "Reclaimable: npm cache clean --force (~0.7 GB); old files in $env:TEMP (~0.2 GB)."
    Write-Host "Owner-only: $env:USERPROFILE\.gradle\caches (~4 GB), $env:LOCALAPPDATA\ms-playwright (~1.4 GB)."
    exit 2
  }
}

if ($Install) {
  Check-Disk
  if (-not (Test-Path $SdkManager)) { Write-Error "sdkmanager not found at $SdkManager"; exit 1 }
  Write-Host "Installing emulator package and $Image (this downloads ~1.8 GB) ..."
  cmd /c "echo y | ""$SdkManager"" --install emulator ""$Image""" 
  if ($LASTEXITCODE -ne 0) { Write-Error "sdkmanager failed ($LASTEXITCODE)"; exit 1 }
  Write-Host "Creating AVD $AvdName (pixel_6) ..."
  cmd /c "echo no | ""$AvdManager"" create avd -n $AvdName -k ""$Image"" -d pixel_6 --force"
  if ($LASTEXITCODE -ne 0) { Write-Error "avdmanager failed ($LASTEXITCODE)"; exit 1 }
  Write-Host "Installed. Boot with: scripts/emulator.ps1 -Boot"
  exit 0
}

if ($Boot) {
  if (-not (Test-Path $EmulatorExe)) { Write-Error "emulator not installed; run scripts/emulator.ps1 -Install"; exit 1 }
  Write-Host "Booting $AvdName ..."
  Start-Process $EmulatorExe -ArgumentList '-avd', $AvdName, '-no-snapshot', '-no-boot-anim', '-no-audio', '-gpu', 'swiftshader_indirect' | Out-Null
  & $Adb wait-for-device
  $deadline = (Get-Date).AddSeconds(240)
  $booted = $false
  while ((Get-Date) -lt $deadline) {
    $v = (& $Adb shell getprop sys.boot_completed 2>$null | Out-String).Trim()
    if ($v -eq '1') { $booted = $true; break }
    Start-Sleep -Seconds 3
  }
  if (-not $booted) { Write-Error "Emulator did not finish booting within 240 s"; exit 1 }
  Start-Sleep -Seconds 5
  # Dismiss a possible "System UI isn't responding" dialog by tapping its Wait button.
  & $Adb shell uiautomator dump /sdcard/ui.xml 2>$null | Out-Null
  $dump = (& $Adb shell cat /sdcard/ui.xml 2>$null | Out-String)
  if ($dump -match 'text="Wait"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"') {
    $x = [int](([int]$Matches[1] + [int]$Matches[3]) / 2); $y = [int](([int]$Matches[2] + [int]$Matches[4]) / 2)
    & $Adb shell input tap $x $y | Out-Null
    Write-Host "Tapped 'Wait' on the System UI dialog"
  }
  & $Adb shell settings put global window_animation_scale 0 | Out-Null
  & $Adb shell settings put global transition_animation_scale 0 | Out-Null
  & $Adb shell settings put global animator_duration_scale 0 | Out-Null
  & $Adb shell settings put system font_scale 1.0 | Out-Null
  & $Adb shell wm density reset | Out-Null
  Write-Host "Booted. Density (default 411 dp): " + ((& $Adb shell wm density | Out-String).Trim())
  exit 0
}

if ($Kill) {
  & $Adb emu kill 2>$null
  Write-Host "Emulator kill requested."
  exit 0
}
