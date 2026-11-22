import type { Cafe } from '../domain'

/** The curated mapsUrl if set, otherwise a Google Maps search for name + address. */
export function mapsLink(cafe: Pick<Cafe, 'name' | 'address' | 'mapsUrl'>): string {
  if (cafe.mapsUrl) return cafe.mapsUrl
  const query = encodeURIComponent(`${cafe.name}, ${cafe.address}`)
  return `https://www.google.com/maps/search/?api=1&query=${query}`
}
