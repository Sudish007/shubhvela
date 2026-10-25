// Type test (design.md 11): a Row without ruleId does not compile. `npm run typecheck` fails if the @ts-expect-error
// line stops erroring (i.e. if someone makes ruleId optional); the runtime assertion keeps the file a real test.
import { screen } from '@testing-library/react-native';
import { Row } from '../src/components';
import { renderWithProviders } from './helpers/render';

function WithoutRuleId() {
  // @ts-expect-error -- ruleId is required: an interpretive sentence cannot render without its Why?
  return <Row>Rahu Kaal runs 13:30 to 14:55.</Row>;
}

describe('Row ruleId contract', () => {
  it('compiles only with a ruleId', async () => {
    expect(typeof WithoutRuleId).toBe('function');
    await renderWithProviders(<Row ruleId="rahu-kaal">Rahu Kaal runs 13:30 to 14:55.</Row>);
    expect(screen.getByText('Why?')).toBeTruthy();
  });
});
