// Travel note (spec F27, design 10.5 F27 "Travel today card ... copy is advisory, never fearful", plan B01).
// travelNote() wraps dishaShool() with the day's Panchak and Bhadra flags and the classical "take this before leaving"
// remedy-free advice key: the engine emits {ruleId, keys, params}; the content package supplies the sentences.
// Panchak restricts travel towards the south (Muhurta Chintamani: "dakshina-disha gamana" among the five Panchak
// prohibitions); Bhadra on earth advises against new beginnings, including setting out on a journey.
import { type GeoPoint, resolveZone } from './astro';
import { type Direction, type DishaShoolInfo, type PanchangDay, dishaShool, panchang } from './panchang';

export interface TravelNote {
  ruleId: 'disha-shool';
  /** Fragment keys: disha-shool-<vara>, plus travel-panchak-south / travel-bhadra-earth when they apply. */
  keys: string[];
  params: {
    vara: number;
    avoid: Direction;
    safe: Direction[];
    panchak: boolean;
    panchakStart: number | null;
    panchakEnd: number | null;
    panchakAvoid: Direction | null;
    bhadraEarth: boolean;
    bhadraStart: number | null;
    bhadraEnd: number | null;
  };
  dishaShool: DishaShoolInfo;
}

/** Fragment keys travelNote() can emit (content daily/travel fragments). */
export const TRAVEL_FRAGMENT_KEYS: readonly string[] = [...Array.from({ length: 7 }, (_, v) => `disha-shool-${v}`), 'travel-panchak-south', 'travel-bhadra-earth'];

/** The travel note of a panchang day (pass the day's PanchangDay to avoid recomputation). */
export function travelNoteFor(p: PanchangDay): TravelNote {
  const ds = dishaShool(p.vara);
  const keys = [`disha-shool-${p.vara}`];
  const earth = p.bhadra.find((b) => b.location === 'earth') ?? null;
  if (p.panchak) keys.push('travel-panchak-south');
  if (earth) keys.push('travel-bhadra-earth');
  return {
    ruleId: 'disha-shool',
    keys,
    params: {
      vara: p.vara,
      avoid: ds.avoid,
      safe: ds.safe,
      panchak: p.panchak !== null,
      panchakStart: p.panchak?.start ?? null,
      panchakEnd: p.panchak?.end ?? null,
      panchakAvoid: p.panchak ? 'south' : null,
      bhadraEarth: earth !== null,
      bhadraStart: earth?.start ?? null,
      bhadraEnd: earth?.end ?? null,
    },
    dishaShool: ds,
  };
}

/** Travel note for a civil date at a place. */
export function travelNote(dayLocal: string, geo: GeoPoint, tz: string): TravelNote {
  return travelNoteFor(panchang(dayLocal, geo, resolveZone(tz)));
}
