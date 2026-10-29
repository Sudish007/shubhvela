declare module 'tz-lookup' {
  /** IANA zone id for a latitude/longitude (tz-lookup, CC0). */
  export default function tzlookup(lat: number, lon: number): string;
}
