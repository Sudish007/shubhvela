// Native Android date/time pickers (design.md 10.1 F1: "date (native picker)"). Thin wrapper so screens stay testable
// (Jest mocks this module) and the 1900-01-01..today bounds live in one place.
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { MIN_DATE } from './validate';

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function timeToHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function hhmmToDate(hhmm: string | null): Date {
  const d = new Date(2000, 0, 1, 12, 0, 0);
  if (hhmm && /^\d{2}:\d{2}$/.test(hhmm)) {
    const [hh, mm] = hhmm.split(':').map(Number);
    d.setHours(hh, mm, 0, 0);
  }
  return d;
}

export function pickDate(current: string | null, onPick: (iso: string) => void, now: Date = new Date()): void {
  DateTimePickerAndroid.open({
    value: current ? isoToDate(current) : new Date(now.getFullYear() - 25, now.getMonth(), now.getDate(), 12),
    mode: 'date',
    minimumDate: isoToDate(MIN_DATE),
    maximumDate: now,
    onValueChange: (_e, d) => onPick(dateToIso(d)),
  });
}

export function pickTime(current: string | null, onPick: (hhmm: string) => void): void {
  DateTimePickerAndroid.open({
    value: hhmmToDate(current),
    mode: 'time',
    is24Hour: true,
    onValueChange: (_e, d) => onPick(timeToHHMM(d)),
  });
}
