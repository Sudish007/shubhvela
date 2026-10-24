# release/

Local build outputs and the release signing material. Only this README is committed.

## Files

| File | Committed? | Purpose |
|---|---|---|
| `Shubhvela-<version>-arm64.apk` | no | device APK (arm64-v8a), built by `scripts/build-apk.ps1 -Abi arm64-v8a -Version <version>` |
| `Shubhvela-<version>-x86_64.apk` | no | emulator APK (x86_64, screenshot mode), built with `-Abi x86_64 -ScreenshotMode` |
| `Shubhvela-<version>.aab` | no | Play Store bundle (4 ABIs), Phase D only |
| `shubhvela-release.keystore` | no | release signing key (PKCS12, alias `shubhvela`, RSA 2048, valid 10000 days) |
| `KEYSTORE-INFO.txt` | no | one `key : value` line each for keystore path, alias, store password, key password and creation date; read by `scripts/build-apk.ps1` |

`<version>` is `expo.version` from `app/app.json` (0.1.0 for Phase A, 0.2.0 B, 0.3.0 C, 1.0.0 D) and must
equal `versionName` in `app/android/app/build.gradle`.

## Signing flow

`scripts/build-apk.ps1` reads `KEYSTORE-INFO.txt` and exports `ORG_GRADLE_PROJECT_SHUBHVELA_STORE_FILE`,
`..._STORE_PASSWORD`, `..._KEY_ALIAS`, `..._KEY_PASSWORD` for the Gradle child process only. The release
`signingConfig` in `app/android/app/build.gradle` uses them when present and falls back to the debug
keystore otherwise. Passwords are never passed on a command line and never printed.

## Owner step: back the keystore up

Copy `shubhvela-release.keystore` and `KEYSTORE-INFO.txt` to an off-machine, encrypted location. Losing
them means the Play listing (`com.shubhvela.app`) can never be updated again and a new listing would be
needed. See `docs/OWNER-TODO.md`.
