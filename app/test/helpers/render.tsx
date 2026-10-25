// Renders under the app providers with fixed safe-area insets (the Screen padding test depends on them).
// @testing-library/react-native 14: render() and fireEvent() are async.
import { render, screen, type RenderOptions, type RenderResult } from '@testing-library/react-native';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';
import { LangProvider, type Lang } from '../../src/i18n';
import { ThemeProvider, type ThemeSetting } from '../../src/theme/ThemeProvider';

export const TEST_INSETS = { top: 24, bottom: 34, left: 0, right: 0 };

export const TEST_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: TEST_INSETS,
};

export interface ProviderOptions {
  lang?: Lang;
  theme?: ThemeSetting;
}

export function Providers({ children, lang = 'en', theme = 'light' }: ProviderOptions & { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={TEST_METRICS}>
      <ThemeProvider initialSetting={theme}>
        <LangProvider initialLang={lang}>{children}</LangProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export function renderWithProviders(ui: ReactElement, opts: ProviderOptions & Omit<RenderOptions, 'wrapper'> = {}): Promise<RenderResult> {
  const { lang, theme, ...rest } = opts;
  return render(ui, { ...rest, wrapper: ({ children }) => <Providers lang={lang} theme={theme}>{children}</Providers> });
}

/** Every host Text in the rendered tree. */
export function allTexts() {
  return screen.root?.queryAll((i) => i.type === 'Text') ?? [];
}

/** The text content of a host Text (nested Text runs joined). */
export function textOf(instance: { children: readonly unknown[] }): string {
  return instance.children.map((c) => (typeof c === 'string' ? c : textOf(c as { children: readonly unknown[] }))).join('');
}
