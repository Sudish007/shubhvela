// Screen padding formula (design.md 2.3, M6, N15) with mocked insets: tabs = 72 + strip(0 in Phase A) + 16 + inset;
// sticky CTA = measured height + 16 + inset; plain stack = 16 + inset. Header exposes the gear with label "Settings".
import { fireEvent, screen } from '@testing-library/react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, screenBottomPadding } from '../src/components';
import { bottomPaddingAboveBanner, bottomPaddingAboveStickyCta, size } from '../src/theme/tokens';
import { TEST_INSETS, renderWithProviders } from './helpers/render';

function contentPadding(): number {
  const style = StyleSheet.flatten(screen.getByTestId('screen-scroll').props.contentContainerStyle);
  return style.paddingBottom as number;
}

describe('Screen', () => {
  it('tab screens pad for the 72 dp tab bar + 16 + the bottom inset (no banner in Phase A)', async () => {
    await renderWithProviders(
      <Screen title="Today">
        <Text>body</Text>
      </Screen>,
    );
    expect(contentPadding()).toBe(size.tabBar + 0 + 16 + TEST_INSETS.bottom);
    expect(contentPadding()).toBe(bottomPaddingAboveBanner(null, TEST_INSETS.bottom));
  });

  it('the formula adds the measured banner + 2 x 16 when AdPolicy reports one', () => {
    expect(screenBottomPadding({ chrome: 'tabs', bannerHeight: 50, ctaHeight: null, insetBottom: 34 })).toBe(72 + (50 + 32) + 16 + 34);
    expect(screenBottomPadding({ chrome: 'stack', bannerHeight: null, ctaHeight: null, insetBottom: 34 })).toBe(16 + 34);
  });

  it('sticky-CTA screens pad for the measured CTA + 16 + inset', async () => {
    await renderWithProviders(
      <Screen title="Before we start" chrome="stack" stickyCta={<View style={{ height: 48 }} />}>
        <Text>body</Text>
      </Screen>,
    );
    await fireEvent.layout(screen.getByTestId('screen-cta'), { x: 0, y: 0, width: 390, height: 80 });
    expect(contentPadding()).toBe(80 + 16 + TEST_INSETS.bottom);
    expect(contentPadding()).toBe(bottomPaddingAboveStickyCta(80, TEST_INSETS.bottom));
  });

  it('the gear is a 44 dp control labelled Settings that opens /settings', async () => {
    await renderWithProviders(
      <Screen title="Today">
        <Text>body</Text>
      </Screen>,
    );
    const gear = screen.getByLabelText('Settings');
    const style = StyleSheet.flatten(gear.props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    await fireEvent.press(gear);
    expect(useRouter().push).toHaveBeenCalledWith('/settings');
  });
});
