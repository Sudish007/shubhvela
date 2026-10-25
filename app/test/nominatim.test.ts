// Nominatim client (design.md 10.1 F1, N8): identifying User-Agent, jsonv2 + limit 5, <= 1 request/s (waits, never
// drops), 8 s timeout, zone from tz-lookup normalised to the engine table, bad rows dropped, errors typed.
import { NOMINATIM_TIMEOUT_MS, NominatimError, resetNominatimGate, searchNominatim, toOnlinePlace, userAgent } from '../src/location/nominatim';

function okResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

describe('nominatim', () => {
  beforeEach(() => resetNominatimGate());

  it('builds the identifying User-Agent', () => {
    expect(userAgent('0.1.0')).toBe('Shubhvela-Android/0.1.0 (+https://sudish007.github.io/shubhvela/)');
  });

  it('sends the UA header, jsonv2 and limit=5, and maps rows with a canonical zone', async () => {
    const fetchMock = jest.fn(async () =>
      okResponse([
        { lat: '26.8467', lon: '80.9462', name: 'Lucknow', display_name: 'Lucknow, Uttar Pradesh, India', address: { city: 'Lucknow', state: 'Uttar Pradesh', country: 'India' } },
        { lat: 'nope', lon: '0', display_name: 'bad row' },
      ]),
    );
    const rows = await searchNominatim('Lucknow', { fetch: fetchMock as unknown as typeof fetch, now: () => 0, sleep: async () => {}, version: '0.1.0' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://nominatim.openstreetmap.org/search?q=Lucknow&format=jsonv2&limit=5&addressdetails=1');
    expect((init.headers as Record<string, string>)['User-Agent']).toBe('Shubhvela-Android/0.1.0 (+https://sudish007.github.io/shubhvela/)');
    expect(init.signal).toBeDefined();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Lucknow', admin1: 'Uttar Pradesh', country: 'India', tz: 'Asia/Kolkata' });
  });

  it('respects the 1 request/s gate by waiting, never dropping', async () => {
    let clock = 1_000_000;
    const sleeps: number[] = [];
    const deps = {
      fetch: jest.fn(async () => okResponse([])) as unknown as typeof fetch,
      now: () => clock,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        clock += ms;
      },
    };
    await searchNominatim('a', deps);
    clock += 300;
    await searchNominatim('b', deps);
    expect(sleeps).toEqual([700]);
    clock += 1500;
    await searchNominatim('c', deps);
    expect(sleeps).toEqual([700]);
    expect((deps.fetch as jest.Mock).mock.calls).toHaveLength(3);
  });

  it('types failures: non-200, network, timeout (8 s AbortController)', async () => {
    const deps = { now: () => 0, sleep: async () => {} };
    await expect(searchNominatim('x', { ...deps, fetch: (async () => ({ ok: false, status: 429 })) as unknown as typeof fetch })).rejects.toMatchObject({ kind: 'http' });
    resetNominatimGate();
    await expect(
      searchNominatim('x', {
        ...deps,
        fetch: (async () => {
          throw new TypeError('Network request failed');
        }) as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(NominatimError);
    resetNominatimGate();
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
    await expect(
      searchNominatim('x', {
        ...deps,
        fetch: (async () => {
          throw abortErr;
        }) as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ kind: 'timeout' });
    expect(NOMINATIM_TIMEOUT_MS).toBe(8000);
  });

  it('drops rows whose coordinates have no zone in the engine table', () => {
    // tz-lookup says Etc/GMT for the open ocean; the engine canonicalises the link to its table key.
    expect(toOnlinePlace({ lat: '0', lon: '0', display_name: 'Null Island' })?.tz).toMatch(/^Etc\/GMT/);
    expect(toOnlinePlace({ lat: '91', lon: '0', display_name: 'nowhere' })).toBeNull();
  });
});
