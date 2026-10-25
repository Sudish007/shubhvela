// +30 % pseudo-locale layout test (design.md 7 / 12): the onboarding birth screen and Settings render with every string
// padded; no Text may truncate (numberOfLines absent) and the padded strings must appear whole. Snapshots pin the trees.
import { screen } from '@testing-library/react-native';
import { loadUi } from '@shubhvela/content';
import BirthScreen from '../app/onboarding/birth';
import SettingsScreen from '../app/settings/index';
import { installTestDb } from './helpers/nodeDb';
import { allTexts, renderWithProviders, textOf } from './helpers/render';

function assertNoTruncation() {
  const texts = allTexts();
  expect(texts.length).toBeGreaterThan(5);
  for (const tx of texts) expect(tx.props.numberOfLines).toBeUndefined();
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('pseudo-locale +30 %', () => {
  let close: () => void;
  beforeEach(() => {
    globalThis.__PSEUDO_LOCALE__ = true;
    ({ close } = installTestDb());
  });
  afterEach(() => {
    globalThis.__PSEUDO_LOCALE__ = undefined;
    close();
  });

  for (const lang of ['en', 'hi', 'bho'] as const) {
    it(`birth screen (${lang}) shows every padded label whole`, async () => {
      const ui = loadUi(lang);
      const tree = await renderWithProviders(<BirthScreen />, { lang });
      assertNoTruncation();
      // Padded strings start with the original and end with the x-padding; both halves must be in the tree.
      for (const key of ['onboarding.birthDate', 'onboarding.birthTime', 'onboarding.timeUnknown', 'onboarding.timeApprox', 'onboarding.place']) {
        const found = screen.getAllByText(new RegExp(`^${escapeRe(ui[key])}`));
        expect(found.length).toBeGreaterThan(0);
        expect(textOf(found[0])).toMatch(/ x*$/);
      }
      if (lang === 'en') expect(tree.toJSON()).toMatchSnapshot();
    });
  }

  it('Settings (en) shows every padded row title whole', async () => {
    const ui = loadUi('en');
    const tree = await renderWithProviders(<SettingsScreen />);
    assertNoTruncation();
    for (const key of ['settings.language', 'settings.theme', 'settings.chartStyle', 'settings.calculation', 'settings.privacy', 'settings.about']) {
      expect(screen.getAllByText(new RegExp(`^${escapeRe(ui[key])}`)).length).toBeGreaterThan(0);
    }
    expect(tree.toJSON()).toMatchSnapshot();
  });
});
