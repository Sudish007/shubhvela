// Theme owner (D9, design.md 2.1): light is the first paint for everyone; dark only through the persisted
// System/Light/Dark setting, which is read SYNCHRONOUSLY from SQLite in the state initialiser so the very first
// render already has the right palette (no flash). 'system' follows Appearance; the default is 'light', not 'system'.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { hasDb } from '../db/connection';
import { getSetting, setSetting, type ThemeSetting } from '../db/settings';
import { colors as palette, type ColorToken, type ThemeName } from './tokens';

export type { ThemeSetting };

export interface ThemeContextValue {
  /** Resolved palette in force. */
  theme: ThemeName;
  /** The persisted user choice. */
  setting: ThemeSetting;
  colors: Record<ColorToken, string>;
  setThemeSetting: (s: ThemeSetting) => void;
}

export function resolveTheme(setting: ThemeSetting, systemScheme: 'light' | 'dark' | null | undefined): ThemeName {
  if (setting === 'system') return systemScheme === 'dark' ? 'dark' : 'light';
  return setting;
}

/** Persisted setting, synchronously; 'light' when nothing is stored or the database is not open (tests). */
export function readInitialThemeSetting(): ThemeSetting {
  try {
    return hasDb() ? getSetting('theme') : 'light';
  } catch {
    return 'light';
  }
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
  /** Override for tests and the dev route; defaults to the persisted setting. */
  initialSetting?: ThemeSetting;
}

export function ThemeProvider({ children, initialSetting }: ThemeProviderProps) {
  const [setting, setSettingState] = useState<ThemeSetting>(() => initialSetting ?? readInitialThemeSetting());
  const scheme = useColorScheme();
  const theme = resolveTheme(setting, scheme);
  const setThemeSetting = useCallback((s: ThemeSetting) => {
    if (hasDb()) setSetting('theme', s);
    setSettingState(s);
  }, []);
  const value = useMemo<ThemeContextValue>(() => ({ theme, setting, colors: palette[theme], setThemeSetting }), [theme, setting, setThemeSetting]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Palette + theme name for components. Outside a provider: light (the first-paint default). */
export function useTokens(): ThemeContextValue {
  const v = useContext(ThemeContext);
  if (!v) return { theme: 'light', setting: 'light', colors: palette.light, setThemeSetting: () => {} };
  return v;
}
