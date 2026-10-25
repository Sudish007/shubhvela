// ThemeProvider (D9): light with no stored setting (database open or not), persisted dark honoured on first render,
// 'system' follows Appearance.
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider, readInitialThemeSetting, resolveTheme, useTokens } from '../src/theme/ThemeProvider';
import { colors } from '../src/theme/tokens';
import { setSetting } from '../src/db/settings';
import { renderWithProviders } from './helpers/render';
import { installTestDb } from './helpers/nodeDb';

function Probe() {
  const { theme, colors: c } = useTokens();
  return <Text testID="probe">{`${theme}:${c.paper}`}</Text>;
}

describe('ThemeProvider', () => {
  it('resolves light when nothing is stored and no database is open', async () => {
    expect(readInitialThemeSetting()).toBe('light');
    await render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('probe')).toHaveTextContent(`light:${colors.light.paper}`);
  });

  it('defaults to light on a fresh database and reads a persisted dark setting synchronously', async () => {
    const { close } = installTestDb();
    try {
      expect(readInitialThemeSetting()).toBe('light');
      setSetting('theme', 'dark');
      expect(readInitialThemeSetting()).toBe('dark');
      await render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
      // First render already dark: no flash of the wrong palette.
      expect(screen.getByTestId('probe')).toHaveTextContent(`dark:${colors.dark.paper}`);
    } finally {
      close();
    }
  });

  it("'system' follows the OS scheme; explicit settings ignore it", () => {
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('system', 'light')).toBe('light');
    expect(resolveTheme('system', null)).toBe('light');
    expect(resolveTheme('light', 'dark')).toBe('light');
    expect(resolveTheme('dark', 'light')).toBe('dark');
  });

  it('exposes the dark palette through the test providers', async () => {
    await renderWithProviders(<Probe />, { theme: 'dark' });
    expect(screen.getByTestId('probe')).toHaveTextContent(`dark:${colors.dark.paper}`);
  });
});
