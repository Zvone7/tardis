import { useMemo } from "react"
import type { SegmentApi, SegmentType, Currency, CurrencyConversion } from "../types/models"
import { normalizeLocation } from "../lib/mapping"
import { locationKeyOf } from "../lib/tripLocations"
import { isTransportType, isAccommodationType, segmentColor } from "../utils/segmentVisuals"
import { convertWithFallback } from "../utils/currency"

export interface ItineraryLocation {
  key: string
  lat: number
  lng: number
  name: string
  country: string
  segments: Array<{ segment: SegmentApi; segmentType: SegmentType }>
}

export interface ItineraryArc {
  startLat: number
  startLng: number
  endLat: number
  endLng: number
  midLat: number
  midLng: number
  color: string
  segment: SegmentApi
  segmentType: SegmentType
}

export interface CostBreakdownEntry {
  category: "Transport" | "Accommodation" | "Other"
  color: string
  segments: Array<{ segment: SegmentApi; segmentType: SegmentType }>
  totalCost: number
  currencyId: number | null
}

export interface ItineraryData {
  locations: ItineraryLocation[]
  arcs: ItineraryArc[]
  costBreakdown: CostBreakdownEntry[]
  totalCost: number
  totalDays: number
  costPerDay: number
  displayCurrencyId: number | null
  dateRange: { start: string | null; end: string | null }
}

export function useItineraryData({
  segments,
  selectedSegmentIds,
  segmentTypes,
  currencies,
  conversions,
  tripCurrencyId,
  displayCurrencyId,
}: {
  segments: SegmentApi[]
  selectedSegmentIds: number[]
  segmentTypes: SegmentType[]
  currencies: Currency[]
  conversions: CurrencyConversion[]
  tripCurrencyId: number | null
  displayCurrencyId: number | null
}): ItineraryData {
  return useMemo(() => {
    const idSet = new Set(selectedSegmentIds)
    const connected = segments.filter((s) => idSet.has(s.id))
    const effectiveCurrencyId = displayCurrencyId ?? tripCurrencyId ?? null

    // Build location map
    const locationMap = new Map<string, ItineraryLocation>()

    const getOrAddLocation = (raw: SegmentApi["startLocation"]) => {
      const loc = normalizeLocation(raw)
      if (!loc || !loc.name) return null
      const key = locationKeyOf(raw)
      if (!key) return null
      if (!locationMap.has(key)) {
        locationMap.set(key, {
          key,
          lat: loc.lat,
          lng: loc.lng,
          name: loc.name,
          country: loc.country ?? "",
          segments: [],
        })
      }
      return locationMap.get(key)!
    }

    const arcs: ItineraryArc[] = []

    for (const seg of connected) {
      const segType = segmentTypes.find((t) => t.id === seg.segmentTypeId) ?? null
      const startKey = locationKeyOf(seg.startLocation)
      const endKey = locationKeyOf(seg.endLocation)

      const startEntry = getOrAddLocation(seg.startLocation)
      const endEntry = getOrAddLocation(seg.endLocation)

      if (isTransportType(segType) && startKey && endKey && startKey !== endKey && startEntry && endEntry) {
        // Transport between two different locations → arc
        const midLat = (startEntry.lat + endEntry.lat) / 2
        const midLng = (startEntry.lng + endEntry.lng) / 2
        arcs.push({
          startLat: startEntry.lat,
          startLng: startEntry.lng,
          endLat: endEntry.lat,
          endLng: endEntry.lng,
          midLat,
          midLng,
          color: segmentColor(segType),
          segment: seg,
          segmentType: segType!,
        })
        // Register segment at both endpoints
        if (segType) {
          startEntry.segments.push({ segment: seg, segmentType: segType })
          endEntry.segments.push({ segment: seg, segmentType: segType })
        }
      } else {
        // Non-transport or same-location transport → register at location(s)
        if (startEntry && segType) startEntry.segments.push({ segment: seg, segmentType: segType })
        if (endEntry && endKey !== startKey && segType) endEntry.segments.push({ segment: seg, segmentType: segType })
      }
    }

    const locations = Array.from(locationMap.values())

    // Cost breakdown by category
    const transportSegs: Array<{ segment: SegmentApi; segmentType: SegmentType }> = []
    const accommodationSegs: Array<{ segment: SegmentApi; segmentType: SegmentType }> = []
    const otherSegs: Array<{ segment: SegmentApi; segmentType: SegmentType }> = []

    for (const seg of connected) {
      const segType = segmentTypes.find((t) => t.id === seg.segmentTypeId) ?? null
      const entry = { segment: seg, segmentType: segType! }
      if (isTransportType(segType)) transportSegs.push(entry)
      else if (isAccommodationType(segType)) accommodationSegs.push(entry)
      else otherSegs.push(entry)
    }

    const sumCost = (segs: typeof transportSegs) => {
      let total = 0
      for (const { segment: seg } of segs) {
        const { amount } = convertWithFallback({
          amount: seg.cost ?? 0,
          fromCurrencyId: seg.currencyId ?? tripCurrencyId ?? null,
          toCurrencyId: effectiveCurrencyId,
          conversions,
        })
        total += amount
      }
      return total
    }

    const costBreakdown: CostBreakdownEntry[] = (
      [
        { category: "Transport" as const, color: "hsl(var(--chart-1))", segments: transportSegs, totalCost: sumCost(transportSegs), currencyId: effectiveCurrencyId },
        { category: "Accommodation" as const, color: "hsl(var(--chart-2))", segments: accommodationSegs, totalCost: sumCost(accommodationSegs), currencyId: effectiveCurrencyId },
        { category: "Other" as const, color: "hsl(var(--chart-3))", segments: otherSegs, totalCost: sumCost(otherSegs), currencyId: effectiveCurrencyId },
      ] satisfies CostBreakdownEntry[]
    ).filter((e) => e.segments.length > 0)

    const totalCost = costBreakdown.reduce((s, e) => s + e.totalCost, 0)

    // Date range
    let minStart: string | null = null
    let maxEnd: string | null = null
    for (const seg of connected) {
      if (seg.startDateTimeUtc && (!minStart || seg.startDateTimeUtc < minStart)) minStart = seg.startDateTimeUtc
      if (seg.endDateTimeUtc && (!maxEnd || seg.endDateTimeUtc > maxEnd)) maxEnd = seg.endDateTimeUtc
    }

    const totalMs = minStart && maxEnd ? new Date(maxEnd).getTime() - new Date(minStart).getTime() : 0
    const totalDays = totalMs > 0 ? Math.ceil(totalMs / (1000 * 60 * 60 * 24)) : 0
    const costPerDay = totalDays > 0 ? totalCost / totalDays : 0

    return { locations, arcs, costBreakdown, totalCost, totalDays, costPerDay, displayCurrencyId: effectiveCurrencyId, dateRange: { start: minStart, end: maxEnd } }
  }, [segments, selectedSegmentIds, segmentTypes, currencies, conversions, tripCurrencyId, displayCurrencyId])
}
