import type { Segment, SegmentType, Currency, CurrencyConversion } from "../types/models"
import type { SegmentFilterValue } from "../components/filters/SegmentFilterPanel"
import type { SegmentSortValue } from "../components/sorting/segmentSortTypes"
import { convertWithFallback } from "../utils/currency"

const getLocationLabel = (loc: any | null) => {
  if (!loc) return ""
  const name = loc?.name ?? ""
  const country = loc?.country ?? ""
  return country ? `${name}, ${country}` : name ?? ""
}

export const buildSegmentMetadata = (segments: Segment[], segmentTypes: SegmentType[]) => {
  const locationSet = new Set<string>()
  const typeSet = new Set<number>()
  let minDate: number | null = null
  let maxDate: number | null = null

  segments.forEach((segment) => {
    const startLoc = (segment as any).startLocation ?? null
    const endLoc = (segment as any).endLocation ?? null
    const startLabel = getLocationLabel(startLoc)
    const endLabel = getLocationLabel(endLoc)
    if (startLabel) locationSet.add(startLabel)
    if (endLabel) locationSet.add(endLabel)
    typeSet.add(segment.segmentTypeId)
    const startTs = new Date(segment.startDateTimeUtc).getTime()
    const endTs = new Date(segment.endDateTimeUtc).getTime()
    if (!Number.isNaN(startTs)) minDate = minDate === null ? startTs : Math.min(minDate, startTs)
    if (!Number.isNaN(endTs)) maxDate = maxDate === null ? endTs : Math.max(maxDate, endTs)
  })

  return {
    locations: Array.from(locationSet),
    types: segmentTypes.filter((type) => typeSet.has(type.id)),
    dateBounds: {
      min: minDate ? new Date(minDate).toISOString().split("T")[0] : "",
      max: maxDate ? new Date(maxDate).toISOString().split("T")[0] : "",
    },
  }
}

export const filterSegments = (segments: Segment[], filters: SegmentFilterValue): Segment[] => {
  const startDate = filters.dateRange.start ? new Date(filters.dateRange.start) : null
  if (startDate) startDate.setHours(0, 0, 0, 0)
  const endDate = filters.dateRange.end ? new Date(filters.dateRange.end) : null
  if (endDate) endDate.setHours(23, 59, 59, 999)

  return segments.filter((segment) => {
    if (!filters.showHidden && segment.isUiVisible === false) return false

    const startLoc = (segment as any).startLocation ?? null
    const endLoc = (segment as any).endLocation ?? null
    const startLabel = getLocationLabel(startLoc)
    const endLabel = getLocationLabel(endLoc)

    if (filters.locations.length > 0 && !filters.locations.some((loc) => loc === startLabel || loc === endLabel)) {
      return false
    }

    if (filters.types.length > 0 && !filters.types.includes(segment.segmentTypeId.toString())) {
      return false
    }

    if (startDate || endDate) {
      const segmentStart = new Date(segment.startDateTimeUtc)
      const segmentEnd = new Date(segment.endDateTimeUtc)
      if (startDate && segmentStart < startDate && segmentEnd < startDate) return false
      if (endDate && segmentStart > endDate && segmentEnd > endDate) return false
    }

    return true
  })
}

interface SegmentCurrencySortArgs {
  targetCurrencyId?: number | null
  fallbackCurrencyId?: number | null
  currencies?: Currency[]
  conversions?: CurrencyConversion[]
}

const resolveSegmentCost = (segment: Segment, currencyArgs?: SegmentCurrencySortArgs) => {
  const base = Number(segment.cost) || 0
  if (!currencyArgs?.currencies || !currencyArgs.conversions) return base
  const converted = convertWithFallback({
    amount: base,
    fromCurrencyId: segment.currencyId ?? null,
    toCurrencyId: currencyArgs.targetCurrencyId ?? currencyArgs.fallbackCurrencyId ?? null,
    conversions: currencyArgs.conversions ?? [],
  })
  return converted.amount
}

export const sortSegments = (
  filtered: Segment[],
  sort: SegmentSortValue | null,
  segmentTypes: SegmentType[],
  currencyArgs?: SegmentCurrencySortArgs,
): Segment[] => {
  const list = [...filtered]
  const typeNameMap = new Map(segmentTypes.map((t) => [t.id, t.name ?? ""]))

  return list.sort((a, b) => {
    if (!sort) {
      const diff = new Date(a.startDateTimeUtc).getTime() - new Date(b.startDateTimeUtc).getTime()
      if (diff !== 0) return diff
      return a.name.localeCompare(b.name)
    }

    const dir = sort.direction === "asc" ? 1 : -1

    switch (sort.field) {
      case "startDate":
        return dir * (new Date(a.startDateTimeUtc).getTime() - new Date(b.startDateTimeUtc).getTime())
      case "endDate":
        return dir * (new Date(a.endDateTimeUtc).getTime() - new Date(b.endDateTimeUtc).getTime())
      case "segmentType":
        return dir * (typeNameMap.get(a.segmentTypeId)?.localeCompare(typeNameMap.get(b.segmentTypeId) ?? "") ?? 0)
      case "startLocation":
        return dir * getLocationLabel((a as any).startLocation ?? (a as any).StartLocation ?? null).localeCompare(
          getLocationLabel((b as any).startLocation ?? (b as any).StartLocation ?? null),
        )
      case "endLocation":
        return dir * getLocationLabel((a as any).endLocation ?? (a as any).EndLocation ?? null).localeCompare(
          getLocationLabel((b as any).endLocation ?? (b as any).EndLocation ?? null),
        )
      case "cost":
        return dir * (resolveSegmentCost(a, currencyArgs) - resolveSegmentCost(b, currencyArgs))
      default:
        return 0
    }
  })
}

export const applySegmentFilters = (
  segments: Segment[],
  filters: SegmentFilterValue,
  sort: SegmentSortValue | null,
  segmentTypes: SegmentType[],
  currencyArgs?: SegmentCurrencySortArgs,
) => {
  const filtered = filterSegments(segments, filters)
  return sortSegments(filtered, sort, segmentTypes, currencyArgs)
}
