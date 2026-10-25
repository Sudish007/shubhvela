// BirthFormValue <-> ProfileInput.
import type { Intent, Profile, ProfileInput } from '../db/profiles';
import { approxMinutesOf, type BirthFormValue, type PlaceChoice } from './validate';

export function formToProfile(v: BirthFormValue, opts: { isSelf: boolean; intent: Intent | null }): ProfileInput {
  if (!v.birthDate || !v.place) throw new Error('validateForm() must pass before formToProfile()');
  return {
    name: v.name.trim() || null,
    gender: v.gender,
    birthDate: v.birthDate,
    birthTime: v.timeUnknown ? null : v.birthTime,
    timeUnknown: v.timeUnknown,
    timeApproxMinutes: approxMinutesOf(v),
    lat: v.place.lat,
    lon: v.place.lon,
    tz: v.place.tz,
    placeName: [v.place.name, v.place.admin1, v.place.country].filter(Boolean).join(', '),
    relationship: opts.isSelf ? 'self' : v.relationship,
    tradition: v.tradition,
    pdfLanguage: v.pdfLanguage,
    intent: opts.intent,
    isSelf: opts.isSelf,
  };
}

export function profileToForm(p: Profile): BirthFormValue {
  const parts = p.placeName.split(',').map((s) => s.trim());
  const place: PlaceChoice = {
    name: parts[0] ?? p.placeName,
    admin1: parts.length === 3 ? parts[1] : '',
    country: parts.length >= 2 ? parts[parts.length - 1] : '',
    lat: p.lat,
    lon: p.lon,
    tz: p.tz,
    source: 'gazetteer',
  };
  return {
    birthDate: p.birthDate,
    birthTime: p.birthTime,
    timeUnknown: p.timeUnknown,
    timeApprox: p.timeApproxMinutes > 0,
    approxMinutes: p.timeApproxMinutes === 15 || p.timeApproxMinutes === 60 ? p.timeApproxMinutes : 30,
    place,
    name: p.name ?? '',
    gender: p.gender,
    relationship: p.relationship,
    tradition: p.tradition,
    pdfLanguage: p.pdfLanguage,
  };
}
