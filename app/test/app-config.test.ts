// Guards the app.json invariants that the committed android/ depends on (plan P1, P13, 4.1 step 6).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import appJson from '../app.json';

const expo = appJson.expo;

describe('app.json', () => {
  it('identifies the app', () => {
    expect(expo.name).toBe('Shubhvela');
    expect(expo.slug).toBe('shubhvela');
    expect(expo.scheme).toBe('shubhvela');
    expect(expo.android.package).toBe('com.shubhvela.app');
  });

  it('keeps version and versionCode paired for the DEV-1 hotfix (0.3.1 / 4) in app.json and build.gradle', () => {
    expect(expo.version).toBe('0.3.1');
    expect(expo.android.versionCode).toBe(4);
    const gradle = readFileSync(join(__dirname, '..', 'android', 'app', 'build.gradle'), 'utf8');
    expect(gradle).toMatch(/versionCode 4\b/);
    expect(gradle).toMatch(/versionName "0\.3\.1"/);
  });

  it('uses only Google test AdMob ids until the owner supplies live ones', () => {
    const admob = expo.extra.admob;
    expect(admob.live).toBe(false);
    expect(admob.appId).toBe('ca-app-pub-3940256099942544~3347511713');
    for (const unit of Object.values(admob.units)) {
      expect(unit.startsWith('ca-app-pub-3940256099942544/')).toBe(true);
    }
  });
});
