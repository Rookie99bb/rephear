// Fixed list of selectable locations. Location is a city, matching
// Ranking.city, so choosing one always corresponds to real Rankings.
export const LOCATIONS = [
  "London",
  "New York",
  "Los Angeles",
  "San Francisco",
  "Austin",
  "Miami",
  "Toronto",
  "Vancouver",
  "Paris",
  "Berlin",
  "Sydney",
  "Melbourne",
  "Tokyo",
  "Osaka",
  "Seoul",
  "Busan",
  "Singapore",
  "Manchester",
  "Dubai",
  "Abu Dhabi",
] as const;

export type Location = (typeof LOCATIONS)[number];

export function isValidLocation(value: string): value is Location {
  return (LOCATIONS as readonly string[]).includes(value);
}

// City -> country metadata. This is the single source of truth for which
// country a Ranking belongs to — country is always DERIVED from city, never
// free-typed. That's what makes country-based flag filtering reliable (no
// more "GB" vs "United Kingdom" mismatches).
export interface LocationInfo {
  city: Location;
  country: string;
  countryCode: string; // ISO 3166-1 alpha-2
  flag: string; // emoji flag, derived from countryCode
}

function flagFromCountryCode(countryCode: string): string {
  // Regional indicator symbols: 'A'-'Z' map to U+1F1E6-U+1F1FF.
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));
}

const CITY_COUNTRY: Record<Location, { country: string; countryCode: string }> = {
  London: { country: "United Kingdom", countryCode: "GB" },
  Manchester: { country: "United Kingdom", countryCode: "GB" },
  "New York": { country: "United States", countryCode: "US" },
  "Los Angeles": { country: "United States", countryCode: "US" },
  "San Francisco": { country: "United States", countryCode: "US" },
  Austin: { country: "United States", countryCode: "US" },
  Miami: { country: "United States", countryCode: "US" },
  Toronto: { country: "Canada", countryCode: "CA" },
  Vancouver: { country: "Canada", countryCode: "CA" },
  Paris: { country: "France", countryCode: "FR" },
  Berlin: { country: "Germany", countryCode: "DE" },
  Sydney: { country: "Australia", countryCode: "AU" },
  Melbourne: { country: "Australia", countryCode: "AU" },
  Tokyo: { country: "Japan", countryCode: "JP" },
  Osaka: { country: "Japan", countryCode: "JP" },
  Seoul: { country: "South Korea", countryCode: "KR" },
  Busan: { country: "South Korea", countryCode: "KR" },
  Singapore: { country: "Singapore", countryCode: "SG" },
  Dubai: { country: "United Arab Emirates", countryCode: "AE" },
  "Abu Dhabi": { country: "United Arab Emirates", countryCode: "AE" },
};

export const LOCATION_INFO: Record<Location, LocationInfo> = Object.fromEntries(
  LOCATIONS.map((city) => {
    const { country, countryCode } = CITY_COUNTRY[city];
    return [city, { city, country, countryCode, flag: flagFromCountryCode(countryCode) }];
  })
) as Record<Location, LocationInfo>;

export function getLocationInfo(city: string): LocationInfo | undefined {
  return isValidLocation(city) ? LOCATION_INFO[city] : undefined;
}

// The canonical country name for a given city. Used whenever a Ranking is
// created/normalized — country is never taken as free-text input.
export function getCountryForCity(city: string): string | undefined {
  return getLocationInfo(city)?.country;
}

export interface CountryInfo {
  country: string;
  countryCode: string;
  flag: string;
  cities: Location[];
}

// Unique countries derived from LOCATIONS, in a stable order (first
// appearance in LOCATIONS), each with its flag and the cities under it.
export function listCountries(): CountryInfo[] {
  const byCountry = new Map<string, CountryInfo>();
  for (const city of LOCATIONS) {
    const info = LOCATION_INFO[city];
    let entry = byCountry.get(info.country);
    if (!entry) {
      entry = { country: info.country, countryCode: info.countryCode, flag: info.flag, cities: [] };
      byCountry.set(info.country, entry);
    }
    entry.cities.push(city);
  }
  return Array.from(byCountry.values());
}

export function getCitiesForCountry(country: string): Location[] {
  return LOCATIONS.filter((city) => LOCATION_INFO[city].country === country);
}
