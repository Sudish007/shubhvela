// A Settings detail screen that is one radio list (language, theme, chart style, tradition): title, optional note,
// RadioRows with the persisted value selected.
import type { ReactNode } from 'react';
import { Card, RadioRow, Screen, Txt } from '../components';

export interface Choice<V extends string> {
  value: V;
  label: string;
  caption?: string;
}

export interface ChoiceScreenProps<V extends string> {
  title: string;
  note?: string;
  choices: readonly Choice<V>[];
  value: V;
  onChange: (v: V) => void;
  children?: ReactNode;
  testID?: string;
}

export function ChoiceScreen<V extends string>({ title, note, choices, value, onChange, children, testID }: ChoiceScreenProps<V>) {
  return (
    <Screen title={title} chrome="stack" testID={testID}>
      {note ? (
        <Txt kind="body" color="ink2">
          {note}
        </Txt>
      ) : null}
      <Card flush>
        {choices.map((c, i) => (
          <RadioRow key={c.value} title={c.label} caption={c.caption} selected={c.value === value} onPress={() => onChange(c.value)} divider={i < choices.length - 1} testID={`choice-${c.value}`} />
        ))}
      </Card>
      {children}
    </Screen>
  );
}
