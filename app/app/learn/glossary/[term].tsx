// Glossary term route (F33): /learn/glossary/<id>?from=why. The screen is src/learn/GlossaryDetail.tsx.
import { useLocalSearchParams } from 'expo-router';
import GlossaryDetail from '../../../src/learn/GlossaryDetail';

export default function GlossaryTermRoute() {
  const { term, from } = useLocalSearchParams<{ term?: string; from?: string }>();
  return <GlossaryDetail id={term ?? ''} from={from} />;
}
