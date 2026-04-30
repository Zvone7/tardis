import type { OptionApi, SegmentApi } from "../types/models"
import type { OptionFilterValue } from "../components/filters/OptionFilterPanel"
import type { OptionSortValue } from "../components/sorting/optionSortTypes"
import { computeCostChips } from "../components/filters/costChips"
import {
  type LocationChip,
  getLocationKey,
  collectLocationIntoMap,
  sortLocationChips,
} from "./locationLabel"

export type { LocationChip }

const DAY_MS = 86_400_000

function padDateBounds(min: number | null, max: number | null): { min: string; max: string } {
  if (min === null || max === null) return { min: "", max: "" }
  return {
    min: new Date(min - DAY_MS).toISOString().split("T")[0],
    max: new Date(max + DAY_MS).toISOString().split("T")[0],
  }
}

function optionPassesNonLocationFilters(
  option: OptionApi,
  filters: OptionFilterValue,
  connectedSegments: Record<number, SegmentApi[]>,
): boolean {
  if (option.isUiVisible === false) return filters.showHidden

  const connected = connectedSegments[option.id]
  const connectedList = connected ?? []

  const startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : null
  if (startDate) startDate.setHours(0, 0, 0, 0)
  const endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : null
  if (endDate) endDate.setHours(23, 59, 59, 999)

  if (startDate || endDate) {
    if (connected === undefined || connectedList.length === 0) return true
    const matchesDate = connectedList.some((segment) => {
      const segmentStart = new Date(segment.startDateTimeUtc)
      const segmentEnd = new Date(segment.endDateTimeUtc)
      if (startDate && segmentStart < startDate) return false
      if (endDate && segmentEnd > endDate) return false
      return true
    })
    if (!matchesDate) return false
  }

  const cost = option.totalCost ?? 0
  if (filters.costMin != null && cost < filters.costMin) return false
  if (filters.costMax != null && cost > filters.costMax) return false

  return true
}

export const buildOptionMetadata = (
  options: OptionApi[],
  connectedSegments: Record<number, SegmentApi[]>,
  segmentsFallback: SegmentApi[],
  filters: OptionFilterValue,
) => {
  const locationMap = new Map<string, string>()
  const startDateSet = new Set<string>()
  const endDateSet = new Set<string>()
  let rawMin: number | null = null
  let rawMax: number | null = null

  const allConnected = Object.values(connectedSegments).flat()
  const hasHydratedSegments = allConnected.length > 0

  const collectSegmentDates = (segment: SegmentApi) => {
    if (segment.startDateTimeUtc) {
      const ts = new Date(segment.startDateTimeUtc).getTime()
      if (!Number.isNaN(ts)) rawMin = rawMin === null ? ts : Math.min(rawMin, ts)
    }
    if (segment.endDateTimeUtc) {
      const ts = new Date(segment.endDateTimeUtc).getTime()
      if (!Number.isNaN(ts)) rawMax = rawMax === null ? ts : Math.max(rawMax, ts)
    }
  }

  const segmentsById = new Map(segmentsFallback.map((s) => [s.id, s as any]))

  if (hasHydratedSegments) {
    options.forEach((option) => {
      if (!optionPassesNonLocationFilters(option, filters, connectedSegments)) return
      const segs = connectedSegments[option.id] ?? []
      segs.forEach((seg) => {
        const fallback = segmentsById.get(seg.id)
        const startLoc = (seg as any).startLocation ?? fallback?.startLocation ?? null
        const endLoc = (seg as any).endLocation ?? fallback?.endLocation ?? null
        collectLocationIntoMap(locationMap, startLoc)
        collectLocationIntoMap(locationMap, endLoc)
      })
    })
    allConnected.forEach(collectSegmentDates)
  } else {
    segmentsFallback.forEach((seg) => {
      collectLocationIntoMap(locationMap, (seg as any).startLocation ?? null)
      collectLocationIntoMap(locationMap, (seg as any).endLocation ?? null)
      collectSegmentDates(seg)
    })
  }

  options.forEach((option) => {
    if (option.startDateTimeUtc) {
      const start = new Date(option.startDateTimeUtc).getTime()
      if (!Number.isNaN(start)) startDateSet.add(new Date(start).toISOString().split("T")[0])
    }
    if (option.endDateTimeUtc) {
      const end = new Date(option.endDateTimeUtc).getTime()
      if (!Number.isNaN(end)) endDateSet.add(new Date(end).toISOString().split("T")[0])
    }
  })

  const costs = options.map((o) => o.totalCost ?? 0)
  const costChips = computeCostChips(costs)

  const locations: LocationChip[] = sortLocationChips(
    Array.from(locationMap.entries()).map(([key, label]) => ({ key, label })),
  )

  return {
    locations,
    uniqueStartDates: Array.from(startDateSet).sort(),
    uniqueEndDates: Array.from(endDateSet).sort(),
    dateBounds: padDateBounds(rawMin, rawMax),
    costChips,
  }
}

export const filterOptions = (
  options: OptionApi[],
  filters: OptionFilterValue,
  connectedSegments: Record<number, SegmentApi[]>,
  segmentsFallback: SegmentApi[] = [],
) => {
  const segmentsById = new Map(segmentsFallback.map((s) => [s.id, s as any]))
  const startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : null
  if (startDate) startDate.setHours(0, 0, 0, 0)
  const endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : null
  if (endDate) endDate.setHours(23, 59, 59, 999)

  return options.filter((option) => {
    if (option.isUiVisible === false) {
      return filters.showHidden
    }

    const connected = connectedSegments[option.id]
    const connectedList = connected ?? []

    if (filters.locations.length > 0) {
      if (connected === undefined) return true
      if (connectedList.length === 0) return false
      const matchesLocation = connectedList.some((segment) => {
        const fallback = segmentsById.get(segment.id)
        const startLoc = (segment as any).startLocation ?? fallback?.startLocation ?? null
        const endLoc = (segment as any).endLocation ?? fallback?.endLocation ?? null
        const startKey = getLocationKey(startLoc)
        const endKey = getLocationKey(endLoc)
        return filters.locations.some((loc) => loc === startKey || loc === endKey)
      })
      if (!matchesLocation) return false
    }

    if (startDate || endDate) {
      if (connected === undefined || connectedList.length === 0) return true
      const matchesDate = connectedList.some((segment) => {
        const segmentStart = new Date(segment.startDateTimeUtc)
        const segmentEnd = new Date(segment.endDateTimeUtc)
        if (startDate && segmentStart < startDate) return false
        if (endDate && segmentEnd > endDate) return false
        return true
      })
      if (!matchesDate) return false
    }

    const cost = option.totalCost ?? 0
    if (filters.costMin != null && cost < filters.costMin) return false
    if (filters.costMax != null && cost > filters.costMax) return false

    return true
  })
}

export const sortOptions = (filtered: OptionApi[], sort: OptionSortValue | null) => {
  const list = [...filtered]
  return list.sort((a, b) => {
    if (!sort) {
      const diff = new Date(a.startDateTimeUtc ?? 0).getTime() - new Date(b.startDateTimeUtc ?? 0).getTime()
      if (diff !== 0) return diff
      return a.name.localeCompare(b.name)
    }

    const dir = sort.direction === "asc" ? 1 : -1
    switch (sort.field) {
      case "startDate":
        return dir * (new Date(a.startDateTimeUtc ?? 0).getTime() - new Date(b.startDateTimeUtc ?? 0).getTime())
      case "endDate":
        return dir * (new Date(a.endDateTimeUtc ?? 0).getTime() - new Date(b.endDateTimeUtc ?? 0).getTime())
      case "totalCost":
        return dir * ((a.totalCost ?? 0) - (b.totalCost ?? 0))
      case "totalDays":
        return dir * ((a.totalDays ?? 0) - (b.totalDays ?? 0))
      default:
        return 0
    }
  })
}

export const applyOptionFilters = (
  options: OptionApi[],
  filters: OptionFilterValue,
  sort: OptionSortValue | null,
  connectedSegments: Record<number, SegmentApi[]>,
  segmentsFallback: SegmentApi[] = [],
) => {
  const filtered = filterOptions(options, filters, connectedSegments, segmentsFallback)
  return sortOptions(filtered, sort)
}
