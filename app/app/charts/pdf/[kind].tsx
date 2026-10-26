// Report preview route (plan B07, M9): /charts/pdf/janam_patri?profile=<id> · /charts/pdf/matching?a=p<id>|c<CODE>&b=...
// · /charts/pdf/varshaphal?profile=<id>&year=<yyyy>. The query is parsed by src/pdf/report.ts; the screen is
// src/pdf/PreviewScreen.tsx.
import { useLocalSearchParams } from 'expo-router';
import PreviewScreen from '../../../src/pdf/PreviewScreen';
import { reportParamsFrom } from '../../../src/pdf/report';

export default function ReportPreviewRoute() {
  const q = useLocalSearchParams<Record<string, string>>();
  return <PreviewScreen params={reportParamsFrom(q.kind, q)} />;
}
