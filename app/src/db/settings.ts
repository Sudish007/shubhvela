// Typed key/value settings (F19 and the UI preferences). Every read is synchronous so the first render can use them.
import type { Ayanamsa, NodeMode } from '@shubhvela/engine';
import { getDb } from './connection';

export type Lang = 'en' | 'hi' | 'bho';
export type ThemeSetting = 'system' | 'light' | 'dark';
export type ChartStyle = 'north' | 'south' | 'east';
export type Tradition = 'purnimanta' | 'amanta';

export interface Settings {
  language: Lang;
  theme: ThemeSetting;
  chartStyle: ChartStyle;
  ayanamsa: Ayanamsa;
  node: NodeMode;
  traditionDefault: Tradition;
}

export const SETTING_DEFAULTS: Settings = {
  language: 'en',
  theme: 'light',
  chartStyle: 'north',
  ayanamsa: 'lahiri',
  node: 'mean',
  traditionDefault: 'purnimanta',
};

const ALLOWED: { [K in keyof Settings]: readonly Settings[K][] } = {
  language: ['en', 'hi', 'bho'],
  theme: ['system', 'light', 'dark'],
  chartStyle: ['north', 'south', 'east'],
  ayanamsa: ['lahiri', 'kp', 'raman'],
  node: ['mean', 'true'],
  traditionDefault: ['purnimanta', 'amanta'],
};

/** Reads one setting; unknown or corrupt values fall back to the default (never throws for a missing row). */
export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
  const v = row?.value as Settings[K] | undefined;
  if (v !== undefined && (ALLOWED[key] as readonly string[]).includes(v as string)) return v;
  return SETTING_DEFAULTS[key];
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  getDb().runSync('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, value]);
}

export function getAllSettings(): Settings {
  return {
    language: getSetting('language'),
    theme: getSetting('theme'),
    chartStyle: getSetting('chartStyle'),
    ayanamsa: getSetting('ayanamsa'),
    node: getSetting('node'),
    traditionDefault: getSetting('traditionDefault'),
  };
}
