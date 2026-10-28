// The "Ask my chart" row's state on the Charts tab and the route a tap opens (design.md 10.7): the device gate is
// checked FIRST (an unsupported phone reads the honest row whatever the tier - there is nothing to sell it), then the
// tier (Pro-only, spec section 9), then whether the verified model is on the phone (consent/download vs chat).
import { isPro } from '../entitlements';
import { deviceGate, type DeviceGate } from './deviceGate';
import { modelStatus, type ModelStatus } from './modelStore';

export type AskRowState = 'unsupported' | 'pro' | 'download' | 'ready';

export function askRowState(pro: boolean, gate: DeviceGate, status: ModelStatus): AskRowState {
  if (!gate.supported) return 'unsupported';
  if (!pro) return 'pro';
  return status === 'ready' ? 'ready' : 'download';
}

export function askRouteFor(state: AskRowState): string {
  switch (state) {
    case 'ready':
      return '/charts/ask/chat';
    case 'download':
      return '/charts/ask/consent';
    default:
      return '/charts/ask/gate';
  }
}

export interface AskSnapshot {
  state: AskRowState;
  gate: DeviceGate;
  status: ModelStatus;
}

/** Reads the three facts once (gate facts are synchronous getters; the model status is a file stat + a flag). */
export function askSnapshot(): AskSnapshot {
  const gate = deviceGate();
  const status = modelStatus();
  return { state: askRowState(isPro(), gate, status), gate, status };
}
