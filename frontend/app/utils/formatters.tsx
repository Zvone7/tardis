import type { SegmentApi, SegmentType, OptionApi, CurrencyConversion } from "../types/models"
import { formatWeekdayDayMonth } from "./dateformatters"
import { getStartLocation, getEndLocation } from "./segmentLocations"
import { convertWithFallback } from "./currency"

export interface TitleToken {
  key: string
  text: string
  iconSvg?: string | null
  emphasize?: boolean
}

const normalizeText = (value?: string | null, fallback: string = "") => (value?.trim() || fallback).trim()

const buildRouteLabel = (startLabel?: string | null, endLabel?: string | null) => {
  const start = normalizeText(startLabel)
  const end = normalizeText(endLabel)
  if (!start && !end) return ""
  if (start && end) return `${start} -> ${end}`
  if (start) return `${start}`
  return `to ${end}`
}

const buildDateRangeLabel = (
  startIso?: string | null,
  endIso?: string | null,
  startOffset?: number | null,
  endOffset?: number | null,
) => {
  if (!startIso && !endIso) return ""
  const startLabel = startIso ? formatWeekdayDayMonth(startIso, startOffset ?? 0) : ""
  const endLabel = endIso ? formatWeekdayDayMonth(endIso, endOffset ?? startOffset ?? 0) : ""
  if (startLabel && endLabel && startLabel !== endLabel) {
    return `${startLabel} -> ${endLabel}`
  }
  return startLabel || endLabel
}

const buildCostLabel = (raw?: number | string | null) => {
  if (raw === null || raw === undefined) return ""
  const parsed = typeof raw === "string" ? Number.parseFloat(raw) : Number(raw)
  if (Number.isNaN(parsed)) return ""
  return `${parsed.toFixed(2)} $`
}

export interface SegmentTitleConfig {
  name?: string | null
  fallbackName?: string
  segmentType?: SegmentType | null
  startLocationLabel?: string | null
  endLocationLabel?: string | null
  startDateIso?: string | null
  endDateIso?: string | null
  startOffset?: number | null
  endOffset?: number | null
  cost?: number | string | null
}

export const buildSegmentTitleTokens = (config: SegmentTitleConfig): TitleToken[] => {
  const tokens: TitleToken[] = []
  const {
    name,
    fallbackName = "Segment",
    segmentType,
    startLocationLabel,
    endLocationLabel,
    startDateIso,
    endDateIso,
    startOffset,
    endOffset,
    cost,
  } = config

  const displayName = normalizeText(name, fallbackName || "Segment")
  if (displayName) tokens.push({ key: "name", text: displayName, emphasize: true })

  if (segmentType?.name) {
    tokens.push({ key: "type", text: "", iconSvg: segmentType.iconSvg })
  }

  const routeLabel = buildRouteLabel(startLocationLabel, endLocationLabel)
  if (routeLabel) tokens.push({ key: "route", text: routeLabel })

  const dateLabel = buildDateRangeLabel(startDateIso, endDateIso, startOffset, endOffset)
  if (dateLabel) tokens.push({ key: "dates", text: dateLabel })

  const costLabel = buildCostLabel(cost)
  if (costLabel) tokens.push({ key: "cost", text: costLabel })

  return tokens
}

export interface OptionTitleConfig {
  name?: string | null
  fallbackName?: string
  segmentCount?: number | null
  startLocationLabel?: string | null
  endLocationLabel?: string | null
  startDateIso?: string | null
  endDateIso?: string | null
  startOffset?: number | null
  endOffset?: number | null
  totalCost?: number | string | null
}

export const buildOptionTitleTokens = (config: OptionTitleConfig): TitleToken[] => {
  const tokens: TitleToken[] = []
  const {
    name,
    fallbackName = "Option",
    segmentCount,
    startLocationLabel,
    endLocationLabel,
    startDateIso,
    endDateIso,
    startOffset,
    endOffset,
    totalCost,
  } = config

  const displayName = normalizeText(name, fallbackName || "Option")
  if (displayName) tokens.push({ key: "name", text: displayName, emphasize: true })

  if (typeof segmentCount === "number" && segmentCount > 0) {
    const text = `${segmentCount} segment${segmentCount === 1 ? "" : "s"}`
    tokens.push({ key: "count", text })
  }

  const routeLabel = buildRouteLabel(startLocationLabel, endLocationLabel)
  if (routeLabel) tokens.push({ key: "route", text: routeLabel })

  const dateLabel = buildDateRangeLabel(startDateIso, endDateIso, startOffset, endOffset)
  if (dateLabel) tokens.push({ key: "dates", text: dateLabel })

  const costLabel = buildCostLabel(totalCost)
  if (costLabel) tokens.push({ key: "cost", text: costLabel })

  return tokens
}

export const tokensToLabel = (tokens: TitleToken[]) => tokens.map((token) => token.text).filter(Boolean).join(", ")

interface SegmentSummaryCurrencyConfig {
  targetCurrencyId?: number | null
  fallbackCurrencyId?: number | null
  conversions?: CurrencyConversion[]
}

export const summarizeSegmentsForOption = (
  segments: SegmentApi[],
  currencyConfig?: SegmentSummaryCurrencyConfig,
) => {
  if (!segments.length) return {}

  const sortedByStart = [...segments].sort(
    (a, b) => new Date(a.startDateTimeUtc).getTime() - new Date(b.startDateTimeUtc).getTime(),
  )
  const earliest = sortedByStart[0]
  const latest = sortedByStart.reduce((prev, seg) => {
    const prevEnd = new Date(prev.endDateTimeUtc).getTime()
    const nextEnd = new Date(seg.endDateTimeUtc).getTime()
    return nextEnd > prevEnd ? seg : prev
  }, sortedByStart[0])

  const startLabel = getStartLocation(earliest as any)?.name ?? ""
  const endLabel = getEndLocation(latest as any)?.name ?? ""
  const totalCost = segments.reduce((sum, seg) => {
    const base = Number(seg.cost) || 0
    if (!currencyConfig?.conversions) {
      return sum + base
    }
    const converted = convertWithFallback({
      amount: base,
      fromCurrencyId: seg.currencyId ?? null,
      toCurrencyId: currencyConfig.targetCurrencyId ?? currencyConfig.fallbackCurrencyId ?? null,
      conversions: currencyConfig.conversions ?? [],
    })
    return sum + converted.amount
  }, 0)

  return {
    segmentCount: segments.length,
    startLocationLabel: startLabel,
    endLocationLabel: endLabel,
    startDateIso: earliest.startDateTimeUtc,
    endDateIso: latest.endDateTimeUtc,
    startOffset: earliest.startDateTimeUtcOffset,
    endOffset: latest.endDateTimeUtcOffset,
    totalCost,
  }
}

export const buildSegmentConfigFromApi = (
  segment: SegmentApi,
  segmentType?: SegmentType,
): SegmentTitleConfig => ({
  name: segment.name,
  fallbackName: segment.name,
  segmentType: segmentType ?? null,
  startLocationLabel: getStartLocation(segment as any)?.name ?? "",
  endLocationLabel: getEndLocation(segment as any)?.name ?? "",
  startDateIso: segment.startDateTimeUtc,
  endDateIso: segment.endDateTimeUtc,
  startOffset: segment.startDateTimeUtcOffset,
  endOffset: segment.endDateTimeUtcOffset,
  cost: segment.cost,
})

export const buildOptionConfigFromApi = (option: OptionApi): OptionTitleConfig => ({
  name: option.name,
  fallbackName: option.name,
  startDateIso: option.startDateTimeUtc,
  endDateIso: option.endDateTimeUtc,
  totalCost: option.totalCost,
})
