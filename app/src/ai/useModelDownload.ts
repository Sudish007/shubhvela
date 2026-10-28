// React binding of the shared ModelDownloader (one per process): subscribes to its phase and exposes the actions.
import { useCallback, useSyncExternalStore } from 'react';
import { sharedDownloader, type DownloadPhase, type ModelDownloader } from './download';

export interface ModelDownloadState {
  phase: DownloadPhase;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => void;
}

export function useModelDownload(downloader: ModelDownloader = sharedDownloader()): ModelDownloadState {
  const subscribe = useCallback((onChange: () => void) => downloader.subscribe(() => onChange()), [downloader]);
  const read = useCallback(() => downloader.state, [downloader]);
  const phase = useSyncExternalStore(subscribe, read, read);
  return {
    phase,
    start: () => downloader.start(),
    pause: () => downloader.pause('user'),
    resume: () => downloader.resume(),
    cancel: () => downloader.cancel(),
  };
}
