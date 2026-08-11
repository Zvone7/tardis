import type { Segment, LocationOption, LocationDto, SegmentApi } from "../types/models"
import { normalizeLocation } from "./mapping"

/** Round to 3 decimal places (~111m precision at the equator). */
export function roundCoord(n: number): number {
  return Math.round(n * 1000) / 1000
}

export function locationKeyOf(loc: LocationOption | LocationDto | null | undefined): string | null {
  const normalized = normalizeLocation(loc)
  if (!normalized || (normalized.lat === 0 && normalized.lng === 0)) return null
  return `${roundCoord(normalized.lat)},${roundCoord(normalized.lng)}`
}

export function locationLabelOf(loc: LocationOption | LocationDto | null | undefined): string | null {
  const normalized = normalizeLocation(loc)
  if (!normalized || !normalized.name) return null
  return normalized.country ? `${normalized.name}, ${normalized.country}` : normalized.name
}

export function isTransitSegment(segment: SegmentApi, stageLocationKey: string): boolean {
  const startKey = locationKeyOf(segment.startLocation)
  const endKey = locationKeyOf(segment.endLocation)
  return startKey === stageLocationKey && endKey !== null && endKey !== stageLocationKey
}

export function extractTripLocations(segments: Segment[]): LocationOption[] {
  const seen = new Map<string, LocationOption>()
  for (const seg of segments) {
    for (const raw of [seg.startLocation, seg.endLocation]) {
      const loc = normalizeLocation(raw)
      if (!loc || !loc.name) continue
      const key = locationKeyOf(raw)
      if (key && !seen.has(key)) seen.set(key, loc)
    }
  }
  return Array.from(seen.values())
}

// Returns a LocationIQ viewbox string "minLng,maxLat,maxLng,minLat" biased toward the trip's region.
// Expands the bbox by ~5 degrees so nearby countries are included.
export function tripViewbox(locations: LocationOption[]): string | undefined {
  const valid = locations.filter((l) => l.lat !== 0 || l.lng !== 0)
  if (valid.length === 0) return undefined
  const lats = valid.map((l) => l.lat)
  const lngs = valid.map((l) => l.lng)
  const pad = 5
  const minLng = Math.max(-180, Math.min(...lngs) - pad)
  const maxLat = Math.min(90, Math.max(...lats) + pad)
  const maxLng = Math.min(180, Math.max(...lngs) + pad)
  const minLat = Math.max(-90, Math.min(...lats) - pad)
  return `${minLng},${maxLat},${maxLng},${minLat}`
}

export function matchTripLocations(query: string, locations: LocationOption[]): LocationOption[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return locations.filter((loc) => {
    const name = (loc.name ?? "").toLowerCase()
    const country = (loc.country ?? "").toLowerCase()
    const formatted = (loc.formatted ?? "").toLowerCase()
    return name.includes(q) || country.includes(q) || formatted.includes(q)
  })
}
