export type AyanamsaType = 'lahiri' | 'raman' | 'kp';

// Shubhvela fork (A04): each ayanamsa is "value at a reference epoch" + the accumulated general precession in
// longitude between that epoch and the date (IAU 2006, Capitaine et al. 2003), without nutation.
//   Lahiri (Chitra Paksha) : anchored to the value Drik Panchang prints as "Lahiri Ayanamsha", which the A04
//                            panchang suite measured on 150 days of 2026-2027 as a constant 7.584" (sd 0.002")
//                            above Lahiri's textbook definition 23 deg 15' 00.658" at 1956-03-21 0h ET
//                            (JD 2435553.5, Swiss Ephemeris SE_SIDM_LAHIRI). The anchor below is therefore
//                            23 deg 15' 08.242" at that epoch (= 24.238279 deg at the 2026-10-22 Delhi
//                            sunrise, Drik's figure). With it the engine reproduces Drik's printed ayanamsa to
//                            < 0.01" and Drik's kundali longitudes to ~1". The upstream library carried the older
//                            J1900 anchor 22.460148 deg, 24" below Drik. See reference/CONVENTIONS.md.
//   Krishnamurti (KP)      : 22.363889 deg at J1900 (SE_SIDM_KRISHNAMURTI).
//   Raman                  : 21.013889 deg at J1900 (SE_SIDM_RAMAN).

const JD_J2000 = 2451545.0;
const JD_J1900 = 2415020.0;
const JD_LAHIRI_T0 = 2435553.5;
const MS_PER_DAY = 86400000;
const JD_UNIX_EPOCH = 2440587.5;

/** Lahiri's definition 23 deg 15' 00.658" plus the 7.584" measured against Drik Panchang (A04). */
export const LAHIRI_1956_DEFINITION_DEG = 23 + 15 / 60 + 0.658 / 3600;
export const LAHIRI_DRIK_CALIBRATION_ARCSEC = 7.584;

const EPOCHS: Record<AyanamsaType, { jd0: number; ayanT0: number }> = {
    lahiri: { jd0: JD_LAHIRI_T0, ayanT0: LAHIRI_1956_DEFINITION_DEG + LAHIRI_DRIK_CALIBRATION_ARCSEC / 3600 },
    kp: { jd0: JD_J1900, ayanT0: 22.363889 },
    raman: { jd0: JD_J1900, ayanT0: 21.013889 },
};

/** Accumulated general precession in longitude from J2000 to T Julian centuries (arcsec, IAU 2006). */
function generalPrecession(T: number): number {
    return 5028.796195 * T + 1.1054348 * T * T + 0.00007964 * T * T * T - 0.000023857 * T ** 4 - 0.0000000383 * T ** 5;
}

export function julianDay(date: Date): number {
    return date.getTime() / MS_PER_DAY + JD_UNIX_EPOCH;
}

export function getAyanamsa(date: Date, type: AyanamsaType = 'lahiri'): number {
    const { jd0, ayanT0 } = EPOCHS[type] ?? EPOCHS.lahiri;
    const T = (julianDay(date) - JD_J2000) / 36525.0;
    const T0 = (jd0 - JD_J2000) / 36525.0;
    return ayanT0 + (generalPrecession(T) - generalPrecession(T0)) / 3600;
}
