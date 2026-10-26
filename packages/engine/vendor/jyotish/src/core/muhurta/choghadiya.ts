import { ChoghadiyaInterval, ChoghadiyaResult, GoodBadRating } from './types';

// Shubhvela patch (2026-10-26, see VENDOR.md): the day cycle follows the hora-lord order
// Sun > Venus > Mercury > Moon > Saturn > Jupiter > Mars = Udveg, Chal, Labh, Amrit, Kaal, Shubh, Rog.
// Upstream had Shubh and Rog swapped in this constant and in the Sun/Mon/Wed/Fri day rows.
export const CHOGHADIYA_ORDER = ['Udveg', 'Chal', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog'];
export const NIGHT_CHOGHADIYA_ORDER = ['Shubh', 'Amrit', 'Chal', 'Rog', 'Kaal', 'Labh', 'Udveg'];

const RATINGS: Record<string, GoodBadRating> = {
    'Udveg': 'bad',
    'Chal': 'neutral',
    'Labh': 'good',
    'Amrit': 'good',
    'Kaal': 'bad',
    'Rog': 'bad',
    'Shubh': 'good'
};

// Each day row is the 7-cycle above starting at the weekday lord's choghadiya (Sun Udveg, Mon Amrit,
// Tue Rog, Wed Labh, Thu Shubh, Fri Chal, Sat Kaal); the 8th slot repeats the 1st.
export const DAY_SEQUENCES: Record<number, string[]> = {
    0: ['Udveg', 'Chal', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog', 'Udveg'], // Sun
    1: ['Amrit', 'Kaal', 'Shubh', 'Rog', 'Udveg', 'Chal', 'Labh', 'Amrit'], // Mon
    2: ['Rog', 'Udveg', 'Chal', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog'],   // Tue
    3: ['Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog', 'Udveg', 'Chal', 'Labh'],   // Wed
    4: ['Shubh', 'Rog', 'Udveg', 'Chal', 'Labh', 'Amrit', 'Kaal', 'Shubh'],   // Thu
    5: ['Chal', 'Labh', 'Amrit', 'Kaal', 'Shubh', 'Rog', 'Udveg', 'Chal'],   // Fri
    6: ['Kaal', 'Shubh', 'Rog', 'Udveg', 'Chal', 'Labh', 'Amrit', 'Kaal']    // Sat
};

// Night rows: the night cycle starts at the choghadiya of the 5th lord from the weekday lord
// (Sun Shubh, Mon Chal, Tue Kaal, Wed Udveg, Thu Amrit, Fri Rog, Sat Labh). Unchanged from upstream.
export const NIGHT_SEQUENCES: Record<number, string[]> = {
    0: ['Shubh', 'Amrit', 'Chal', 'Rog', 'Kaal', 'Labh', 'Udveg', 'Shubh'], // Sun
    1: ['Chal', 'Rog', 'Kaal', 'Labh', 'Udveg', 'Shubh', 'Amrit', 'Chal'],  // Mon
    2: ['Kaal', 'Labh', 'Udveg', 'Shubh', 'Amrit', 'Chal', 'Rog', 'Kaal'],   // Tue
    3: ['Udveg', 'Shubh', 'Amrit', 'Chal', 'Rog', 'Kaal', 'Labh', 'Udveg'],  // Wed
    4: ['Amrit', 'Chal', 'Rog', 'Kaal', 'Labh', 'Udveg', 'Shubh', 'Amrit'],  // Thu
    5: ['Rog', 'Kaal', 'Labh', 'Udveg', 'Shubh', 'Amrit', 'Chal', 'Rog'],    // Fri
    6: ['Labh', 'Udveg', 'Shubh', 'Amrit', 'Chal', 'Rog', 'Kaal', 'Labh']    // Sat
};

function getIntervals(start: Date, end: Date, sequence: string[]): ChoghadiyaInterval[] {
    const totalDuration = end.getTime() - start.getTime();
    const durationPerpart = totalDuration / 8;
    const intervals: ChoghadiyaInterval[] = [];

    for (let i = 0; i < 8; i++) {
        const segStart = new Date(start.getTime() + (i * durationPerpart));
        const segEnd = new Date(start.getTime() + ((i + 1) * durationPerpart));
        const name = sequence[i];

        intervals.push({
            name,
            startTime: segStart,
            endTime: segEnd,
            rating: RATINGS[name]
        });
    }

    return intervals;
}

export function calculateChoghadiya(sunrise: Date, sunset: Date, nextSunrise: Date, vara: number): ChoghadiyaResult {
    const daySeq = DAY_SEQUENCES[vara];
    const dayChoghadiya = getIntervals(sunrise, sunset, daySeq);

    const nightSeq = NIGHT_SEQUENCES[vara];
    const nightChoghadiya = getIntervals(sunset, nextSunrise, nightSeq);

    return {
        day: dayChoghadiya,
        night: nightChoghadiya
    };
}
