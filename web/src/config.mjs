// Site-wide constants for the static generator (plan.md D01; build-rules: base path /shubhvela/ everywhere).
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WEB_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO_DIR = resolve(WEB_DIR, '..');

/** Absolute origin + base path with a trailing slash (D12, build-rules). */
export const BASE_URL = 'https://sudish007.github.io/shubhvela/';
/** Path prefix every href starts with (GitHub project pages). */
export const BASE_PATH = '/shubhvela/';
export const LANGS = ['en', 'hi', 'bho'];
/** hreflang codes Google accepts (design.md 9, M10): ISO 639-1 only, never `bho`. */
export const HREFLANG_LANGS = ['en', 'hi'];
export const DEFAULT_LANG = 'en';
export const APP_PACKAGE = 'com.shubhvela.app';
export const APP_SCHEME = 'shubhvela';
export const SOURCE_URL = 'https://github.com/Sudish007/shubhvela';
/** The city whose "today" the home page shows (design.md 9: "Today · New Delhi"). */
export const HOME_CITY_SLUG = 'new-delhi';
/** Featured city cards on the home page (the mock's eight; the full 331 list follows them). */
export const FEATURED_CITY_SLUGS = ['new-delhi', 'mumbai', 'patna', 'lucknow', 'varanasi', 'kolkata', 'chennai', 'kathmandu'];
/** Fonts self-hosted from the app's bundle (design.md 2.2, N12; copied by the build, never read). */
export const FONT_FILES = {
  display: 'TiroDevanagariHindi-Regular.ttf',
  sansRegular: 'NotoSans-Regular.ttf',
  sansSemiBold: 'NotoSans-SemiBold.ttf',
  devaRegular: 'NotoSansDevanagari-Regular.ttf',
  devaSemiBold: 'NotoSansDevanagari-SemiBold.ttf',
};
export const FONT_SRC_DIR = resolve(REPO_DIR, 'app', 'assets', 'fonts');

/** Absolute URL for a site path such as `/en/kundli/`. */
export function absUrl(path) {
  return BASE_URL + path.replace(/^\//, '');
}
/** Href for a site path (`/en/kundli/` -> `/shubhvela/en/kundli/`). */
export function href(path) {
  return BASE_PATH + path.replace(/^\//, '');
}
