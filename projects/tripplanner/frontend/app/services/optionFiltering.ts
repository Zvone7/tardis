import type { OptionApi, SegmentApi } from "../types/models"
import type { OptionFilterValue } from "../components/filters/OptionFilterPanel"
import type { OptionSortValue } from "../components/sorting/optionSortTypes"
import { computeCostChips } from "../components/filters/costChips"

const getLocationLabel = (loc: any | null) => {
  if (!loc) return ""
  const name = loc?.name ?? ""
  const country = loc?.country ?? ""
  return country ? `${name}, ${country}` : name ?? ""
}

export const buildOptionMetadata = (options: OptionApi[], segments: SegmentApi[]) => {
  const locations = new Set<string>()
  const startDateSet = new Set<string>()
  const endDateSet = new Set<string>()
  let minDate: number | null = null
  let maxDate: number | null = null

  segments.forEach((segment) => {
    const startLoc = (segment as any).startLocation ?? null
    const endLoc = (segment as any).endLocation ?? null
    const startLabel = getLocationLabel(startLoc)
    const endLabel = getLocationLabel(endLoc)
    if (startLabel) locations.add(startLabel)
    if (endLabel) locations.add(endLabel)
  })

  options.forEach((option) => {
    if (option.startDateTimeUtc) {
      const start = new Date(option.startDateTimeUtc).getTime()
      if (!Number.isNaN(start)) {
        minDate = minDate === null ? start : Math.min(minDate, start)
        startDateSet.add(new Date(start).toISOString().split("T")[0])
      }
    }
    if (option.endDateTimeUtc) {
      const end = new Date(option.endDateTimeUtc).getTime()
      if (!Number.isNaN(end)) {
        maxDate = maxDate === null ? end : Math.max(maxDate, end)
        endDateSet.add(new Date(end).toISOString().split("T")[0])
      }
    }
  })

  const costs = options.map((o) => o.totalCost ?? 0)
  const costChips = computeCostChips(costs)

  return {
    locations: Array.from(locations),
    uniqueStartDates: Array.from(startDateSet).sort(),
    uniqueEndDates: Array.from(endDateSet).sort(),
    dateBounds: {
      min: minDate ? new Date(minDate).toISOString().split("T")[0] : "",
      max: maxDate ? new Date(maxDate).toISOString().split("T")[0] : "",
    },
    costChips,
  }
}

export const filterOptions = (
  options: OptionApi[],
  filters: OptionFilterValue,
  connectedSegments: Record<number, SegmentApi[]>,
) => {
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
        const startLoc = (segment as any).startLocation ?? null
        const endLoc = (segment as any).endLocation ?? null
        const startLabel = getLocationLabel(startLoc)
        const endLabel = getLocationLabel(endLoc)
        return filters.locations.some((loc) => loc === startLabel || loc === endLabel)
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
) => {
  const filtered = filterOptions(options, filters, connectedSegments)
  return sortOptions(filtered, sort)
}
