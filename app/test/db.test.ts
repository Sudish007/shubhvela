// Schema/migrations and repositories against a real SQLite (node:sqlite).
import { USER_TABLES, SCHEMA_VERSION } from '../src/db/schema';
import { currentVersion } from '../src/db/migrations';
import { consentAt, recordConsent } from '../src/db/appState';
import { countProfiles, deleteProfile, getSelfProfile, insertProfile, listProfiles, updateProfile, type ProfileInput } from '../src/db/profiles';
import { insertAncestor, listAncestors } from '../src/db/ancestors';
import { getSetting, setSetting } from '../src/db/settings';
import { countEnabledSeries, setSeriesEnabled } from '../src/db/eventSeries';
import { deleteEverything } from '../src/db/deleteEverything';
import { installTestDb } from './helpers/nodeDb';

const PRIYA: ProfileInput = {
  name: 'Priya',
  gender: 'female',
  birthDate: '1998-03-14',
  birthTime: '06:42',
  timeUnknown: false,
  timeApproxMinutes: 30,
  lat: 26.85,
  lon: 80.95,
  tz: 'Asia/Kolkata',
  placeName: 'Lucknow, Uttar Pradesh, India',
  relationship: 'self',
  tradition: 'purnimanta',
  pdfLanguage: 'hi',
  intent: 'marriage',
  isSelf: true,
};

describe('database', () => {
  let close: () => void;
  let db: ReturnType<typeof installTestDb>['db'];
  beforeEach(() => {
    ({ db, close } = installTestDb());
  });
  afterEach(() => close());

  it('migrates to SCHEMA_VERSION and creates every plan.md table', () => {
    expect(currentVersion(db)).toBe(SCHEMA_VERSION);
    const names = db.getAllSync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => r.name);
    for (const t of USER_TABLES) expect(names).toContain(t);
  });

  it('settings default and persist', () => {
    expect(getSetting('theme')).toBe('light');
    expect(getSetting('language')).toBe('en');
    expect(getSetting('ayanamsa')).toBe('lahiri');
    setSetting('theme', 'dark');
    setSetting('ayanamsa', 'kp');
    setSetting('node', 'true');
    expect(getSetting('theme')).toBe('dark');
    expect(getSetting('ayanamsa')).toBe('kp');
    expect(getSetting('node')).toBe('true');
    // Corrupt values fall back to the default instead of throwing.
    db.runSync("UPDATE settings SET value = 'neon' WHERE key = 'theme'");
    expect(getSetting('theme')).toBe('light');
  });

  it('profiles round-trip, F2 flags included', () => {
    const id = insertProfile(PRIYA, new Date('2026-10-25T00:00:00Z'));
    const self = getSelfProfile();
    expect(self?.id).toBe(id);
    expect(self?.timeApproxMinutes).toBe(30);
    expect(self?.timeUnknown).toBe(false);
    expect(self?.intent).toBe('marriage');
    updateProfile(id, { ...PRIYA, timeUnknown: true, birthTime: '06:42', timeApproxMinutes: 60 });
    const again = getSelfProfile()!;
    expect(again.timeUnknown).toBe(true);
    expect(again.birthTime).toBeNull();
    expect(again.timeApproxMinutes).toBe(0);
    insertProfile({ ...PRIYA, name: 'Amma', relationship: 'mother', isSelf: false });
    expect(countProfiles()).toBe(2);
    expect(listProfiles()[0].isSelf).toBe(true);
    deleteProfile(id);
    expect(getSelfProfile()).toBeNull();
  });

  it('ancestors are separate from profiles and reminder series count only when enabled', () => {
    insertAncestor({ name: 'Dadaji', relation: 'grandfather', deathMonth: 6, paksha: 'krishna', tithi: 10, year: null });
    expect(listAncestors()).toHaveLength(1);
    expect(countProfiles()).toBe(0);
    setSeriesEnabled('barsi', '1', true);
    setSeriesEnabled('vrat_family', 'ekadashi', true);
    setSeriesEnabled('vrat_family', 'pradosh', false);
    expect(countEnabledSeries()).toBe(2);
  });

  it('deleteEverything empties every table and cancels scheduled notifications', async () => {
    insertProfile(PRIYA);
    recordConsent(new Date('2026-10-25T10:00:00Z'));
    setSetting('theme', 'dark');
    db.runSync("INSERT INTO unlocks (feature, expires_at) VALUES ('kp', '2099-01-01T00:00:00Z')");
    const cancel = jest.fn(async () => {});
    await deleteEverything({ cancelScheduledNotifications: cancel });
    expect(cancel).toHaveBeenCalledTimes(1);
    for (const t of USER_TABLES) expect(db.getFirstSync<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`)?.n).toBe(0);
    expect(consentAt()).toBeNull();
    expect(getSetting('theme')).toBe('light');
  });
});
