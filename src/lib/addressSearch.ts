/*
 * @name: UK address search
 * @description: Free address lookups for the admin. postcodes.io (official open data) completes postcodes and gives
 * the town; Photon (OpenStreetMap) finds streets and often house numbers. Neither has every UK address (that data is
 * licensed by Royal Mail), so results always fill an address you can still edit.
 * */

import { SITE_HOST } from './site';

export interface AddressSuggestion {
  label: string;
  address: string; // one line per part, ready for the address box
  source: 'postcodes.io' | 'openstreetmap';
}

const TIMEOUT_MS = 4000;
const USER_AGENT = `${SITE_HOST} admin address search`;
const cache = new Map<string, { at: number; results: AddressSuggestion[] }>();
const CACHE_MS = 24 * 3_600_000;

// A full or partial UK postcode, e.g. "OX1", "OX1 1", "OX1 1AA"
const POSTCODE_START = /^[A-Z]{1,2}\d[A-Z\d]?(\s*\d[A-Z]{0,2})?$/i;

function lines(...parts: (string | undefined | null)[]) {
  return parts.map((part) => (part ?? '').trim()).filter(Boolean);
}

async function getJson(url: string, init: RequestInit = {}) {
  const res = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...init.headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function searchPostcodes(query: string): Promise<AddressSuggestion[]> {
  const partial = query.toUpperCase().replace(/\s+/g, ' ').trim();
  const { result } = await getJson(`https://api.postcodes.io/postcodes/${encodeURIComponent(partial)}/autocomplete?limit=5`);
  if (!Array.isArray(result) || !result.length) return [];
  const bulk = await getJson('https://api.postcodes.io/postcodes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postcodes: result }),
  });
  return (bulk.result ?? [])
    .map((item: { result: { postcode: string; admin_district?: string; parish?: string; admin_county?: string } | null }) => item.result)
    .filter(Boolean)
    .map((p: { postcode: string; admin_district?: string; parish?: string; admin_county?: string }) => {
      // "Leeds, unparished area" isn't a place name
      const town = p.parish && !/unparished/i.test(p.parish) ? p.parish.replace(/,.*$/, '') : p.admin_district;
      return {
        label: `${p.postcode}, ${town ?? ''}: then add the house number and street`,
        address: lines('', town, p.admin_county, p.postcode).join('\n'),
        source: 'postcodes.io' as const,
      };
    });
}

interface PhotonProps {
  name?: string;
  housenumber?: string;
  street?: string;
  district?: string;
  locality?: string;
  city?: string;
  county?: string;
  postcode?: string;
  countrycode?: string;
}

async function searchOpenStreetMap(query: string): Promise<AddressSuggestion[]> {
  const params = new URLSearchParams({ q: query, limit: '8', lang: 'en', bbox: '-8.65,49.86,1.77,60.86' });
  const data = await getJson(`https://photon.komoot.io/api/?${params}`);
  return (data.features ?? [])
    .map((feature: { properties: PhotonProps }) => feature.properties)
    // Bare postcode entries carry no street, and postcodes.io handles those better
    .filter((p: PhotonProps) => p.countrycode === 'GB' && (p.street || p.name) && !(p.name && POSTCODE_START.test(p.name) && !p.street))
    .map((p: PhotonProps) => {
      // OSM sometimes gives the council ("Cherwell District") as the city; the district or locality is the town people use
      const town = p.city && /district|council|borough/i.test(p.city) ? p.district || p.locality || p.city : p.city || p.district || p.locality;
      const firstLine = lines(p.housenumber, p.street).join(' ') || p.name;
      const address = lines(firstLine, town, p.postcode);
      // A shop or building name helps pick the right result, but isn't part of the address
      const name = p.name && p.name !== firstLine ? p.name : '';
      return { label: lines(name, ...address).join(', '), address: address.join('\n'), source: 'openstreetmap' as const };
    });
}

export async function searchAddresses(raw: string) {
  const query = raw.replace(/\s+/g, ' ').trim().slice(0, 100);
  if (query.length < 3) return [];
  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.results;

  // Either service being down shouldn't break the other
  const [postcodes, osm] = await Promise.all([
    POSTCODE_START.test(query) ? searchPostcodes(query).catch(() => []) : Promise.resolve([]),
    searchOpenStreetMap(query).catch(() => []),
  ]);
  const seen = new Set<string>();
  const results = [...postcodes, ...osm].filter((s) => !seen.has(s.address) && seen.add(s.address)).slice(0, 8);

  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), results });
  return results;
}
