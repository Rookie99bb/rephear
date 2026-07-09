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
