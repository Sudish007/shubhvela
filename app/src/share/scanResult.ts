// Hand-off between the scan route (/family/scan?side=a|b) and the matching pick screen: the scan screen stores the
// decoded code here and goes back; the pick screen consumes it on focus. In memory only (nothing is persisted).
import type { MatchSideKey } from '../match/model';

interface Pending {
  side: MatchSideKey;
  /** 20-character normalised code (the payload re-encoded, so a scanned URL and a scanned code arrive the same way). */
  code: string;
  /** 'link' when a shubhvela://m deep link delivered it (the picker then says "From a link", not "Scanned code"). */
  via?: 'link';
}

let pending: Pending | null = null;

export function setScanResult(side: MatchSideKey, code: string, via?: 'link'): void {
  pending = via ? { side, code, via } : { side, code };
}

/** Returns and clears the pending result. */
export function takeScanResult(): Pending | null {
  const p = pending;
  pending = null;
  return p;
}

export function resetScanResultForTests(): void {
  pending = null;
}
