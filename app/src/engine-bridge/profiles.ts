// Profile row -> engine BirthInput (the only place that knows both shapes).
import type { BirthInput } from '@shubhvela/engine';
import type { Profile, ProfileInput } from '../db/profiles';

export function toBirthInput(p: ProfileInput | Profile): BirthInput {
  return {
    date: p.birthDate,
    time: p.timeUnknown || !p.birthTime ? undefined : p.birthTime,
    timeUnknown: p.timeUnknown,
    approxMinutes: p.timeUnknown ? 0 : p.timeApproxMinutes,
    tz: p.tz,
    lat: p.lat,
    lon: p.lon,
  };
}
