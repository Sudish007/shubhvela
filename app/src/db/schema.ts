// SQLite schema (plan.md section 2). Each entry of MIGRATIONS is applied once, in order, and PRAGMA user_version
// records how many have run. Never edit a shipped migration: append a new one.
export const SCHEMA_VERSION = 3;

export const USER_TABLES = [
  'settings',
  'profiles',
  'ancestors',
  'event_series',
  'scheduled',
  'saved_muhurats',
  'unlocks',
  'entitlements',
  'purchases',
  'journal',
  'prashna',
  'lessons_done',
  'app_state',
] as const;

export type UserTable = (typeof USER_TABLES)[number];

export const MIGRATIONS: readonly string[] = [
  // v1 (A09): every table of plan.md section 2 so later clusters only add columns/indexes.
  `
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    gender TEXT,
    birth_date TEXT NOT NULL,
    birth_time TEXT,
    time_unknown INTEGER NOT NULL DEFAULT 0,
    time_approx_minutes INTEGER NOT NULL DEFAULT 0,
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    tz TEXT NOT NULL,
    place_name TEXT NOT NULL,
    relationship TEXT NOT NULL DEFAULT 'other',
    tradition TEXT NOT NULL DEFAULT 'purnimanta',
    pdf_language TEXT NOT NULL DEFAULT 'en',
    intent TEXT,
    is_self INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ancestors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    relation TEXT NOT NULL,
    death_month INTEGER NOT NULL,
    paksha TEXT NOT NULL,
    tithi INTEGER NOT NULL,
    year INTEGER
  );
  CREATE TABLE IF NOT EXISTS event_series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 0,
    UNIQUE (kind, ref_id)
  );
  CREATE TABLE IF NOT EXISTS scheduled (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    series_id INTEGER NOT NULL,
    fire_at TEXT NOT NULL,
    notification_id TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS saved_muhurats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    activity TEXT NOT NULL,
    start TEXT NOT NULL,
    end TEXT NOT NULL,
    rules_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS unlocks (
    feature TEXT PRIMARY KEY NOT NULL,
    expires_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS entitlements (
    product TEXT PRIMARY KEY NOT NULL,
    token TEXT,
    state TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product TEXT NOT NULL,
    ref_id TEXT,
    token TEXT,
    delivered_at TEXT
  );
  CREATE TABLE IF NOT EXISTS journal (
    day TEXT PRIMARY KEY NOT NULL,
    mood TEXT,
    note TEXT
  );
  CREATE TABLE IF NOT EXISTS prashna (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    ts TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL
  );
  CREATE TABLE IF NOT EXISTS lessons_done (
    lesson_id TEXT PRIMARY KEY NOT NULL,
    done_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_profiles_self ON profiles (is_self);
  CREATE INDEX IF NOT EXISTS idx_event_series_kind ON event_series (kind, enabled);
  CREATE INDEX IF NOT EXISTS idx_scheduled_series ON scheduled (series_id);
  `,
  // v2 (B04): notifications that belong to no event series (dasha changes, the Vedic-year instant) record their kind
  // so Settings -> Notifications labels them honestly instead of as the daily note (series_id 0).
  `
  ALTER TABLE scheduled ADD COLUMN kind TEXT;
  `,
  // v3 (C04, F18): a Prashna is re-rendered in the zone of the place it was asked at, so the zone is stored with the
  // instant and the coordinates (older rows have no zone and render in UTC).
  `
  ALTER TABLE prashna ADD COLUMN tz TEXT;
  `,
];
