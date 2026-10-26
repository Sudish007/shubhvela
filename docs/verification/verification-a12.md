# Verification A12 - Family tab: tithi birthdays, shraddha, vrats, festival calendar, local reminders

Date: 2026-10-25. Cluster A12 (FEAT-A12, plan.md 4.2; design.md 10.1 F3, 10.4 F20-F25, 11, 12; review items M7, N5, N12; mock family.html).
Commit: `feat(F20): Family tab - tithi birthdays, shraddha, vrats, festival calendar, local reminders`.

## 1. What was built

Files (all under `c:/Users/sudiskmr/Downloads/DomainClassification/shubhvela`):

- Engine: `packages/engine/scripts/build-verified-dates.ts` (new; `npm run build:verified -w packages/engine`) generates `packages/engine/data/verified-dates.json` (new, 356 slug|year|tradition|date entries = every festival-year whose engine date at the reference city equals the Drik Panchang page date, with the page's `fetched_at`); `packages/engine/src/calendar/verified.ts` (new) exports `festivalVerification(slug, year, tradition, date)`, `verifiedFestivalCount()`, `VERIFIED_DATES_GENERATED_AT`; re-exported from `calendar/index.ts`; `packages/engine/test/verified.test.ts` (new, 2 tests).
- Content: 61 new UI keys x 3 languages (824 -> 885; namespaces family/events/vrat/calendar/reminders only; register tests green).
- App data layer: `app/src/db/eventSeries.ts` (seriesKey, listSeries, listEnabledSeries, isSeriesEnabled, seriesId, enabledVratFamilies), `app/src/db/scheduled.ts` (new: count/list/listDetailed/clear/insert for the `scheduled` table), `app/src/db/reminderSettings.ts` (new: per-kind evening/morning times with defaults 19:00/07:00, daily-note opt-in default Off, failed-series list, lastPlannedAt; all under `reminder.*` keys of the settings table), `app/src/db/ancestors.ts` (+getAncestor, countAncestors, updateAncestor), `app/src/db/settings.ts` (+`festivalRegion` north|south).
- Reminders: `app/src/notifications/planner.ts` (pure: planOccurrences, planNotifications, notificationText; MAX_SCHEDULED 300, HORIZON_DAYS 60), `app/src/notifications/schedule.ts` (applyPlan, plannerInputFromDb, replanAll, expoScheduleDeps; channel `events`), `app/src/notifications/permissions.ts` (getPermissionState, requestPermission, openSystemNotificationSettings).
- Family tab: `app/app/(tabs)/family.tsx` (rewritten), `app/src/family/{model.ts, format.ts, useSeries.ts, ProfileRow.tsx, FamilyTodayCard.tsx, EventCard.tsx, VratCard.tsx, VratTodayCard.tsx, CalendarList.tsx, FestivalDetail.tsx}` (new).
- Routes: `app/app/family/ancestor/[id].tsx`, `app/app/family/calendar.tsx`, `app/app/family/festival/[slug].tsx`, `app/app/family/vrat/[id].tsx`, `app/app/settings/vrats.tsx` (new); `app/app/settings/notifications.tsx` (rewritten); `app/app/settings/index.tsx` (+Vrats row); `app/app/_layout.tsx` (routes registered, `setNotificationHandler`, launch re-plan 1.5 s after mount).
- Today: `app/src/today/model.ts` (+`vratToday`, `vratFamilies` option), `app/src/today/useToday.ts` (passes the enabled families), `app/app/(tabs)/today.tsx` (F22 vrat-today card), `app/src/today/UpcomingStrip.tsx` (vrat card -> `/family/vrat/<family>`, "All dates" -> `/family/calendar`).
- Tests: `app/test/{planner.test.ts, family-screen.test.tsx, calendar.test.tsx, notifications-settings.test.tsx}` (new), `entitlements.test.ts` (+2), `flows.test.tsx` (F3 flow re-pointed to the avatar row), `setup.ts` (expo-notifications mock extended), snapshots `family-screen` and `calendar` (new), `pseudo-locale` (Settings gained the Vrats row).

## 2. Commands and results

| Command | Result |
|---|---|
| `npm test -w app` | Test Suites: 21 passed, 21 total · Tests: 133 passed, 133 total · Snapshots: 6 passed, 6 total · 46 s |
| `npm run typecheck` (root, all workspaces) | exit 0, no errors |
| `npm run lint` (root; eslint over app) | exit 0, 0 problems |
| `npm test -w packages/engine` (extra, because the engine gained a module) | Test Files 18 passed, 1 skipped · Tests 717 passed, 1 skipped · 14.5 s (results.json timestamps restored afterwards; not part of the commit) |
| `npm test -w packages/content` (extra, because 61 keys were added) | 9 files, 84 tests passed (identical key sets en/hi/bho, register, forbidden words) |
| `npx tsx packages/engine/scripts/build-verified-dates.ts` | `356 verified slug-year-tradition dates out of 359 compared` |

A11 -> A12 app counts: 17 suites / 107 tests / 4 snapshots -> 21 suites / 133 tests / 6 snapshots (+26 tests: planner 6, family-screen 5, calendar 6, notifications-settings 7, entitlements +2).

## 3. Acceptance criteria checked by the tests

- F3: avatar row with 56 dp initials, selected = 2 px accent ring, "Add" dashed with "Pro · unlimited" at 2/2 on free; the 3rd profile opens the honest cap sheet (`family-screen`, `flows`). Quota line "2 of 2 profiles · N of 5 reminders (free)" + Pro text button (honest Pro-not-in-this-build sheet).
- F20: one card per profile "Tithi birthday · <relationship> · in N days / <name> · janma tithi / <month paksha tithi> · <date> · year N" (Priya: Chaitra Krishna Pratipada · Tue 23 Mar 2027 · year 29), On/Off series switch, Why? with month system / Adhik / kshaya inputs; the planner yields the evening-before and morning-of notifications at 19:00/07:00 in the profile zone (`planner` test shifts the clock to March 2027 to catch Priya's date; TodayTithiRow from A10 covers the Today row).
- F21: ancestor editor (name, relation chips, Hindu month chips in the profile's tradition, paksha segmented, tithi chips, optional year) saves a record that never counts toward profiles (`entitlements`, `notifications-settings`); the card reads "Shraddha · barsi · ancestor record" with the Pitru Paksha day; the calendar highlights the barsi and Pitru Paksha rows (`calendar`). An ancestor who passed inside Pitru Paksha gets ONE row/notification for that day (Dadaji case).
- F22: enabled vrat families get a card with the computed key time (Ekadashi parana window glued as one run, N4) and the "What to do" text from corpus/vrats with Why?; Settings -> Vrats lists the 12 families as switches with the cap line; the vrat detail lists the next year of occurrences; the F22 vrat-today card appears on Today for enabled families only.
- F23: three years (current month -> December of year+2) with Purnimanta/Amanta and North/South segmented toggles (state visible, region persisted); 56 dp rows; the tithi text changes month naming between the systems (Karwa Chauth: Kartik vs Ashwin Krishna Chaturthi) and the region changes the set (Chhath north-only, Karthigai Deepam south-only); the festival detail shows date, tithi, city sunrise/moonrise, puja window, What to do with Why?, and the footer "Verified against Drik Panchang on <fetch date>" ONLY when the user's computed date equals the verified date (Diwali 2026 at Lucknow = Delhi date -> verified), else "Not yet verified against a reference panchang". No share button (B07).
- F24: Family Today rows "Name: Moon in the Nth house, <tara> tara" + the corpus Chandra bala line (Chandrashtama stated plainly by chandra-bala-8), each with Why? (ruleId family-today).
- F25: quiet by default (no enabled series -> empty plan, `replanAll` schedules nothing); permission denied -> nothing scheduled, switch stays Off, inline "Allow notifications in Android settings" row; the 6th enabled series on free opens the honest sheet and nothing changes (Family cards and Settings -> Vrats); the plan is capped at 300 nearest-first (N12) with daily-note opt-in default Off; per-event scheduling errors are caught, recorded per series and shown as a "not scheduled" tag; `applyPlan` cancels everything before re-scheduling; Settings -> Notifications shows per-kind times (native time picker, persisted, re-plan), the daily-note switch (disabled until permission), and the real "Scheduled" count + list from the `scheduled` table.
- M7: footer buttons read "Add family member" / "Add shraddha" / "Add vrat" (no "Add tithi birthday"). N5: display name = profile name, relationship in the kind label. No "Family tools" card, no share/match/naamkaran rows.

## 4. Decisions worth knowing

- Scheduling observer = the self profile's place (deterministic; GPS mode only moves the Today band). Ancestor months are interpreted in the self profile's calendar tradition (the editor states which); the ancestors table has no tradition column (design.md F21 schema kept).
- The Family tab shows vrat cards only for ENABLED families; "Add vrat" opens Settings -> Vrats where all 12 can be switched on. The Today Upcoming vrat card and the vrat-today card use the enabled families too (engine `upcoming.vratFamilies`); with none enabled Upcoming keeps searching all twelve (A10 behaviour).
- The festival calendar lists the whole current month (passed days included) through December of year+2 - "3 years ahead" from the current year.
- `verified-dates.json` is keyed by slug|year|tradition|date and compared against the user's own computed date, so a place whose moonrise/aparahna rule shifts a day honestly reads "not yet verified".
- Barsi series fire for both the barsi and the Pitru Paksha day; when both are the same day (death inside Pitru Paksha) only one occurrence is planned and listed.

## 5. Not verified (A13 and later)

- Actual notification delivery on a device/emulator (channel creation, DATE triggers, airplane-mode firing, Doze) - the F25 smoke test with a 2-minute series is A13's emulator step; here the OS bridge is covered by the fake-deps tests only.
- The POST_NOTIFICATIONS prompt flow on Android 13+, `Linking.openSettings()`, and the native time picker (mocked under Jest).
- Light/dark rendering, 44 dp boxes and the 12 sp floor on screen, 360/390/412 dp and 1.3x font scale, TalkBack order - A13 screenshot audit (Family, Family-calendar, Festival-detail, Settings).
- Three-year calendar compute time on a mid-range phone (~1 s expected from the engine timings; computed in an effect behind a skeleton and cached per toggle state).
- Hindi/Bhojpuri wording of the 61 new keys (owner review, like every bho string).
- Background re-plan (C01) and the "Exact widget updates" / "Dasha change alerts" rows (C01 / B04) are intentionally absent.
