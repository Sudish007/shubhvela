// The fixed line above every on-device answer (spec F35, D8): "AI explanation from your chart — can be wrong" at
// 13 sp (caption), with its own Why? (rule id `ask-label`) so the honesty marker explains itself like every other
// row. The text is the ui key `ask.label`, pinned by the content completeness test; nothing here rephrases it.
import { Row } from '../components/Row';
import { Txt } from '../components/Txt';
import { useLang } from '../i18n';

export interface AiLabelProps {
  /** Rule ids the answer used, listed in the Why? sheet inputs. */
  ruleIds?: readonly string[];
  model?: string;
  testID?: string;
}

export function AiLabel({ ruleIds = [], model = 'Gemma 4 E2B (LiteRT-LM)', testID = 'ai-label' }: AiLabelProps) {
  const { t } = useLang();
  const text = t('ask.label');
  return (
    <Row ruleId="ask-label" text={text} inputs={{ [t('common.source')]: model, [t('common.rule')]: ruleIds.join(', ') || t('common.none') }} divider={false} testID={testID}>
      <Txt kind="caption" color="ink2" weight={600} testID={`${testID}-text`}>
        {text}
      </Txt>
    </Row>
  );
}
