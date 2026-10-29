# Shubhvela — personal-data breach process (DPDP Act 2023 + DPDP Rules 2025)

Design-review item N14. Written 2026-10-30 for release 1.0.0. Owner and only operator: Sudish Kumar (the Data
Fiduciary under the Act). Grievance mailbox: `grievance@shubhvela.in` — **provisional** until OWNER-TODO item 8 is
done; the same address appears in the app (Settings → Privacy), the consent notice, the privacy page and the Play
listing, so change all of them on the same day.

## 1. Scope — what Shubhvela holds and what it does not

Shubhvela has **no server, no account system and no share-code relay in v1** (plan.md P12/P13; OWNER-TODO item 9
keeps the relay "deferred"). The only personal data the project ever processes is:

| Where | What | Who can reach it |
|---|---|---|
| The user's phone (`shubhvela.db`, SQLite) | Profiles (name, relation, birth date/time/place, coordinates), reminders, journal entries, Prashna history, purchase tokens, settings | The user and whoever controls the unlocked phone |
| Backup files the user creates | The same tables, AES-256-GCM encrypted with a key derived from the user's password (PBKDF2, 600,000 rounds) | Whoever holds the file **and** the password |
| PDFs and share cards the user exports | Chart data, name, birth details (birth time only if the user toggled it on) | Whoever the user sent them to |
| Share codes / QR | Birth data of one profile, encoded in the code itself (no lookup service) | Whoever scans or receives the code |
| Third-party processors | Google Play (purchases), Google AdMob (ad identifiers, free tier), OpenStreetMap Nominatim (typed place name on explicit action), Hugging Face (model download request) | Those services under their own policies |
| The web companion (`sudish007.github.io/shubhvela`) | Static files only; the kundli form runs in the browser and the URL carries the visitor's inputs, which GitHub Pages logs like any web server | GitHub (hosting) |

Because nothing is stored by the owner, the owner **cannot** leak user data from a database he does not have. The
breach scenarios that remain are listed in §2. If a relay service or any server-side feature is added later, this
document must be rewritten before that feature ships (and the Data safety form updated).

## 2. What counts as a personal-data breach here

Under section 2(u) of the DPDP Act a breach is any unauthorised processing, disclosure, acquisition, sharing, use,
alteration, destruction or loss of access to personal data that compromises its confidentiality, integrity or
availability. For an offline app that means:

| # | Scenario | Who notices | Is the owner the fiduciary responsible? |
|---|---|---|---|
| B1 | **Compromised release signing key** (`release/shubhvela-release.keystore` + `KEYSTORE-INFO.txt` copied or lost) — an attacker could ship a malicious update that reads the database | Owner (missing/leaked file, Play Console warning) | Yes |
| B2 | **Malicious or defective update published by us** that exfiltrates, corrupts or deletes user data (supply-chain compromise of a dependency, a bad GitHub Action, a stolen Play Console login) | Owner, users, Play | Yes |
| B3 | **Defect in the backup encryption or restore** that writes plaintext, uses a weak key, or restores someone else's data | Owner (bug report, review), users | Yes |
| B4 | **Defect that sends data off the device** that the privacy policy does not name (e.g. a library starts calling home, Nominatim called without the tap) | Owner (code review, network audit) | Yes |
| B5 | **Web companion compromise** (Pages deploy replaced, malicious script injected into the kundli form) | Owner (`live-check`, GitHub security alerts) | Yes |
| B6 | A user's **phone is lost or stolen**, or a backup file is leaked by the user | The user | No — the user controls that copy; we help (§4.4) but it is not a fiduciary breach |
| B7 | A **third-party processor** (Google, OSM, Hugging Face) suffers a breach involving data our app sent | Processor notification / press | Partly — we relay the information to users if it concerns data our app transmitted |

## 3. Roles

| Role | Person | Duties |
|---|---|---|
| Data Fiduciary and incident lead | Sudish Kumar | Everything below; signs the Board intimation |
| Grievance officer (DPDP s. 13 / Rule on grievance redressal) | Sudish Kumar via `grievance@shubhvela.in` | Acknowledges within 48 h, answers within the period stated on the privacy page |
| Technical help | None on retainer. The repository is public; the build steps are documented in `docs/` | — |

## 4. The 72-hour procedure

The DPDP Rules 2025 (breach-intimation rule, Rule 7 in the notified text) require two intimations by the Data
Fiduciary on becoming aware of a breach: **(a) to every affected Data Principal, without delay**, and **(b) to the Data
Protection Board of India, without delay and in any case within 72 hours** of becoming aware (a longer period only
if the Board allows it in writing). The clock starts when the owner first learns of the incident, not when it is
confirmed.

### 4.1 Hour 0–4 — contain and record

1. Open the breach log (template in §6) with the time you became aware and how.
2. Stop the bleeding by scenario:
   - **B1** — in Play Console, request an **upload-key reset** (Play App Signing protects the app signing key; our
     keystore is the upload key). Generate a new keystore with `keytool`, write new `KEYSTORE-INFO.txt`, delete every
     copy of the old one you still control. Rotate the Play Console password and 2-factor device. Check Play Console →
     Release → App bundle explorer for releases you did not make.
   - **B2 / B4** — halt the staged rollout (Play Console → Release → Halt), publish a fixed build as a priority
     release, audit `git log` and the GitHub Actions run list for commits/runs you did not trigger, rotate the
     `GEMINI_API_KEY` secret and the GitHub token, enable "require 2FA" if not already.
   - **B3** — ship a fixed build; if existing backup files are affected, tell users to re-create them after updating
     and to delete the old files.
   - **B5** — disable GitHub Pages for the repository (Settings → Pages → Unpublish), rotate the GitHub password and
     tokens, review `pages.yml` and the deploy history, re-enable only from a clean commit.
   - **B7** — collect the processor's notice; identify which data types our app sends to that processor (store-listing
     Data safety table).
3. Preserve evidence: copy the relevant Play Console pages (screenshots), Action logs, `git log --all`, device logs if a
   user supplied them. Do not rewrite history in the repository.

### 4.2 Hour 4–24 — assess

Record in the log: what data types are involved (use the Data safety taxonomy), how many users could be affected
(Play Console install counts per release are the only numbers we have — there is no user list), whether the data was
encrypted (backups: yes if the password is strong; database: protected by the phone's own encryption), the likely
consequences for users, and the cause. Decide whether the event is a breach under §2. If it is **not** (e.g. B6, or a
suspected defect that turns out not to transmit anything), close the log with the reasoning and stop here.

### 4.3 Within 72 hours — notify

Because we have **no contact details for any user**, intimation to Data Principals is done through the channels we
control, all at once:

1. **In-app**: a release with a "Security notice" line in Settings → About and on the Today screen's first card
   (plain text, no fear language, says what happened, what we did, what the user should do, and the grievance
   address). Ship it as a priority update.
2. **Web banner**: a notice at the top of every page of the web companion for at least 30 days (`web/src/templates/
   layout.mjs` has the header; add the notice there) — in English, Hindi and Bhojpuri.
3. **Play listing**: the "What's new" text of the fixed release names the notice.
4. **Repository**: a `SECURITY-NOTICE-<date>.md` in `docs/` with the same text.

The notice to users must contain (per the Rule): a description of the breach (nature, extent, timing, location);
the likely consequences; the measures taken and proposed; what the user can do to protect themselves (update the app,
re-create backups, reset the advertising ID, uninstall if they prefer); and how to reach us.

**Board intimation** (Data Protection Board of India, through the form or address the Board publishes at the time —
check https://www.meity.gov.in/ for the current channel): send within 72 hours a first report with the description,
circumstances and probable cause, the data types and the estimated number of affected principals, the remedial
measures, and what was told to users. Follow with the findings of §4.2 and the final report when the investigation
is complete (the Rule allows the detailed report to follow the initial intimation). Keep the sent copies in the log.

### 4.4 A user reports a lost phone or a leaked backup (B6)

Not a fiduciary breach, but answer within 48 hours from the grievance mailbox: there is no server copy to revoke;
advise them to use Android's "Find My Device" wipe, to treat the backup password as the only protection of the file,
and to delete shared PDFs/share codes where they posted them. Log the contact (no personal details beyond the
mailbox thread).

### 4.5 After the incident

Within 30 days: a post-mortem in the breach log (root cause, what detection would have caught it earlier, what
changed), a review of this document, and an entry in `docs/RELEASE-NOTES.md`. If the Data safety answers changed
because of the incident, update the Play form and `app/playstore-assets/store-listing.md` the same week.

## 5. Preventive controls already in place (as of 1.0.0)

- Keystore and its passwords are gitignored; the build script passes them to Gradle through environment variables
  only (`scripts/build-apk.ps1`). Off-machine backup is owner step 7.
- No server, no account, no analytics SDK of ours; four named network endpoints (Data safety table).
- Backup: AES-256-GCM with PBKDF2-SHA256 (600,000 rounds), random salt and nonce per file; the file header is
  versioned so a weak format can be retired.
- Pro never initialises the ads SDK (asserted by `app/test/ads-root.test.tsx`).
- The repository is public; CI runs tests and lint on every push; `package-lock.json` pins dependency versions.
- Web: static site, no forms post anywhere, inputs stay in the URL; `live-check.mjs` verifies the deployed pages.

## 6. Breach log template

Keep one file per incident at `docs/incidents/<yyyy-mm-dd>-<short-name>.md` (folder created on first use; keep it
free of user personal data).

```
# Incident <yyyy-mm-dd> <short name>
Became aware: <date time IST> via <source>
Scenario: B1 | B2 | B3 | B4 | B5 | B6 | B7 (see BREACH-PROCESS.md §2)
Breach under DPDP s.2(u)? yes / no / under assessment — reasoning:

## Timeline (IST)
- <time> — <what happened / what was done>

## Data involved
Types (Play taxonomy): …
Estimated principals affected: … (basis: Play install counts for releases …)
Encrypted? …

## Containment
…

## Notifications
- Users: in-app notice shipped in <version> on <date>; web banner live <date>–<date>; docs/SECURITY-NOTICE-<date>.md
- Board: initial intimation sent <date time> via <channel>; follow-up <date>; final report <date>
- Processors / others: …

## Root cause and fixes
…

## Post-mortem (within 30 days)
…
Closed: <date>, by Sudish Kumar
```
