// Honesty / layout components (design.md 12): Switch state + On/Off text in both themes, Pressable44 minimum box,
// Chip/Segmented accessibilityState, Row renders its Why? control, NoBreak glue, Tag/ApproxTag wording.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { ApproxTag, Chip, NoBreak, Num, Pressable44, Row, Segmented, Switch, Tag, noBreak } from '../src/components';
import { glossaryIdsFor } from '../src/components/WhySheet';
import { renderWithProviders, textOf } from './helpers/render';

describe('Switch', () => {
  for (const theme of ['light', 'dark'] as const) {
    it(`exposes accessibilityState.checked and shows On/Off text (${theme})`, async () => {
      const onChange = jest.fn();
      await renderWithProviders(<Switch value={false} onValueChange={onChange} accessibilityLabel="Dark theme" testID="sw" />, { theme });
      const sw = screen.getByTestId('sw');
      expect(sw.props.accessibilityRole).toBe('switch');
      expect(sw.props.accessibilityState.checked).toBe(false);
      expect(screen.getByText('Off')).toBeTruthy();
      await fireEvent.press(sw);
      expect(onChange).toHaveBeenCalledWith(true);
      await renderWithProviders(<Switch value={true} onValueChange={onChange} accessibilityLabel="Dark theme" testID="sw2" />, { theme });
      expect(screen.getByTestId('sw2').props.accessibilityState.checked).toBe(true);
      expect(screen.getByText('On')).toBeTruthy();
    });
  }
});

describe('Pressable44', () => {
  it('has a visible box of at least 44 x 44 dp', async () => {
    await render(
      <Pressable44 accessibilityLabel="Why?" testID="p" onPress={() => {}}>
        <Text>Why?</Text>
      </Pressable44>,
    );
    const style = StyleSheet.flatten(screen.getByTestId('p').props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });
});

describe('Chip and Segmented', () => {
  it('report selected state and fire onPress / onChange', async () => {
    const onPress = jest.fn();
    const onChange = jest.fn();
    await renderWithProviders(
      <>
        <Chip label="Marriage" selected onPress={onPress} testID="chip" />
        <Segmented accessibilityLabel="Approximate" value={30} onChange={onChange} options={[{ value: 15, label: '±15 min' }, { value: 30, label: '±30 min' }, { value: 60, label: '±60 min' }]} />
      </>,
    );
    expect(screen.getByTestId('chip').props.accessibilityState.selected).toBe(true);
    await fireEvent.press(screen.getByTestId('chip'));
    expect(onPress).toHaveBeenCalled();
    const thirty = screen.getByLabelText('±30 min');
    expect(thirty.props.accessibilityRole).toBe('radio');
    expect(thirty.props.accessibilityState).toMatchObject({ selected: true, checked: true });
    await fireEvent.press(screen.getByLabelText('±60 min'));
    expect(onChange).toHaveBeenCalledWith(60);
  });
});

describe('Row', () => {
  it('renders the sentence and a 44 dp Why? control that opens the rule sheet', async () => {
    await renderWithProviders(
      <Row ruleId="rahu-kaal" inputs={{ weekday: 'Thursday', sunrise: '06:26' }}>
        Rahu Kaal runs 13:30 to 14:55.
      </Row>,
    );
    expect(screen.getByText('Rahu Kaal runs 13:30 to 14:55.')).toBeTruthy();
    const why = screen.getByLabelText('Why? Rahu Kaal runs 13:30 to 14:55.');
    const style = StyleSheet.flatten(why.props.style);
    expect(style.minWidth).toBeGreaterThanOrEqual(44);
    await fireEvent.press(why);
    expect(screen.getByText('Inputs')).toBeTruthy();
    expect(screen.getByText('06:26')).toBeTruthy();
  });

  it('derives glossary ids from the rule id', () => {
    expect(glossaryIdsFor('sade-sati-phase-1')).toEqual(['sade-sati-phase-1', 'sade-sati-phase', 'sade-sati', 'sade']);
    expect(glossaryIdsFor('rahu-kaal', ['hora'])).toEqual(['hora', 'rahu-kaal', 'rahu']);
  });
});

describe('NoBreak / Num', () => {
  it('keeps a time range on one line: no breakable whitespace, joiners around the dash', async () => {
    const glued = noBreak('06:28–08:53');
    expect(glued).not.toMatch(/[ \t\n]/);
    expect(glued).toContain('\u2060–\u2060');
    expect(noBreak('Uttara Phalguni 4')).toBe('Uttara\u00A0Phalguni\u00A04');
    await renderWithProviders(<NoBreak numeric>{'06:28 – 08:53'}</NoBreak>);
    const text = screen.getByText(/06:28/);
    expect(textOf(text)).not.toMatch(/[ \t\n]/);
    const style = StyleSheet.flatten(text.props.style);
    expect(style.fontVariant).toEqual(['tabular-nums']);
    expect(style.fontFamily).toBe('NotoSans');
  });

  it('Num forces Noto Sans tabular digits inside a Devanagari UI', async () => {
    await renderWithProviders(<Num>{'26°15′'}</Num>, { lang: 'hi' });
    const style = StyleSheet.flatten(screen.getByText('26°15′').props.style);
    expect(style.fontFamily).toBe('NotoSans');
    expect(style.fontVariant).toEqual(['tabular-nums']);
  });
});

describe('Tag', () => {
  it('ApproxTag owns the approx. wording and reads the minutes', async () => {
    await renderWithProviders(
      <>
        <ApproxTag />
        <ApproxTag minutes={30} />
        <Tag variant="dignity">exalted</Tag>
      </>,
    );
    expect(screen.getByText('approx.')).toBeTruthy();
    expect(screen.getByText('approx. ±30 min')).toBeTruthy();
    const style = StyleSheet.flatten(screen.getByText('exalted').props.style);
    expect(style.fontSize).toBe(12);
  });
});
