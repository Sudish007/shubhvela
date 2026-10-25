// tz-lookup (CC0-1.0) ships no typings: lat/lon -> IANA zone id (throws on out-of-range input).
declare module 'tz-lookup' {
  export default function tzLookup(lat: number, lon: number): string;
}
