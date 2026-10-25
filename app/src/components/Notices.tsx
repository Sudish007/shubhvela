// InlineNotice: one-line notice inside a card or form (errors of design.md 11: Nominatim failure, offline), hairline
// box, never a toast or a blocking dialog. EmptyState: the honest "not here yet" / "nothing yet" block used instead of
// fake rows; it states plainly what will arrive in a later build or what the user can add.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTokens } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { Txt } from './Txt';

export interface InlineNoticeProps {
  children: string;
  /** 'error' colours the text accent; 'info' keeps ink2. */
  tone?: 'info' | 'error';
}

export function InlineNotice({ children, tone = 'info' }: InlineNoticeProps) {
  const { colors } = useTokens();
  return (
    <View accessibilityRole="alert" style={[styles.notice, { borderColor: tone === 'error' ? colors.accent : colors.hair2, backgroundColor: colors.surface }]}>
      <Txt kind="caption" color={tone === 'error' ? 'accent' : 'ink2'}>
        {children}
      </Txt>
    </View>
  );
}

export interface EmptyStateProps {
  title: string;
  body?: string;
  /** An action row (e.g. "Add family member"). */
  children?: ReactNode;
}

export function EmptyState({ title, body, children }: EmptyStateProps) {
  const { colors } = useTokens();
  return (
    <View style={[styles.empty, { borderColor: colors.hair, backgroundColor: colors.surface }]}>
      <Txt kind="heading">{title}</Txt>
      {body ? (
        <Txt kind="body" color="ink2">
          {body}
        </Txt>
      ) : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { borderWidth: 1, borderRadius: radius.button, paddingHorizontal: 12, paddingVertical: 8 },
  empty: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.card, padding: 16, gap: 8 },
  actions: { marginTop: 8, gap: 8 },
});
