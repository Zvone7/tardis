// OptionsList.tsx
// Reusable filter panel + card grid for options.
// Used by OptionsPageContent (legacy route) and TripPageContent (new 3-panel route).
"use client"

import { useState, useMemo, useCallback } from "react"
import { Skeleton } from "../components/ui/skeleton"
import { Card, CardTitle } from "../components/ui/card"
import { Button } from "../components/ui/button"
import { EditIcon, EyeIcon, EyeOffIcon, LinkIcon } from "lucide-react"
import { Checkbox } from "../components/ui/checkbox"
import SelectPopupMenu from "../components/SelectPopupMenu"
import BatchConnectSegmentModal from "./BatchConnectSegmentModal"
import { OptionFilterPanel, type OptionFilterValue } from "../components/filters/OptionFilterPanel"
import type { OptionSortValue } from "../components/sorting/optionSortTypes"
import { applyOptionFilters, buildOptionMetadata } from "../services/optionFiltering"
import { computeCostChips } from "../components/filters/costChips"
import { cn } from "../lib/utils"
import { optionsApi } from "../utils/apiClient"
import { formatCurrencyAmount, formatConvertedAmount, convertWithFallback } from "../utils/currency"
import { formatDateWithUserOffset, formatWeekday } from "../utils/dateformatters"
import type { OptionApi, SegmentApi, SegmentType, Currency, CurrencyConversion } from "../types/models"
import { useTripLayout } from "../trip/[tripId]/TripLayoutContext"
import { TimelineSegmentCard } from "../components/timeline/TimelineSegmentCard"

// ---- local types ----

type ConnectedSegment = SegmentApi & { segmentType: SegmentType }

// ---- helper fns ----

const formatOptionDateWithWeekday = (iso: string | null, offset: number) => {
  if (!iso) return "N/A"
  const weekday = formatWeekday(iso, offset)
  const formatted = formatDateWithUserOffset(iso, offset)
  return `${weekday}, ${formatted}`
}

function normalizeCostPerType(raw?: Record<string | number, number> | null) {
  const out = { Accommodation: 0, Transport: 0, Other: 0 }
  if (!raw) return out
  for (const key of Object.keys(raw)) {
    const val = Number((raw as any)[key]) || 0
    const lower = String(key).toLowerCase()
    if (lower.includes("accom")) { out.Accommodation += val; continue }
    if (lower.includes("trans")) { out.Transport += val; continue }
    if (lower.includes("other")) { out.Other += val; continue }
    const asNum = Number(key)
    if (!Number.isNaN(asNum)) {
      if (asNum === 0) out.Accommodation += val
      else if (asNum === 1) out.Transport += val
      else if (asNum === 2) out.Other += val
    }
  }
  return out
}

// ---- sub-components ----

function CostPieChart({ accommodation, transport, other }: { accommodation: number; transport: number; other: number }) {
  const total = accommodation + transport + other
  const radius = 32
  const circumference = 2 * Math.PI * radius
  const segs = [
    { label: "Transport", value: transport, color: "hsl(var(--chart-1))" },
    { label: "Accommodation", value: accommodation, color: "hsl(var(--chart-2))" },
    { label: "Other", value: other, color: "hsl(var(--chart-3))" },
  ]
  let accumulated = 0
  return (
    <svg width="90" height="90" viewBox="0 0 90 90" className="shrink-0">
      <circle cx="45" cy="45" r={radius} fill="transparent" stroke="hsl(var(--muted))" strokeWidth="14" />
      {total > 0 && segs.map((seg) => {
        if (seg.value <= 0) return null
        const dash = (seg.value / total) * circumference
        const circle = (
          <circle
            key={seg.label}
            cx="45" cy="45" r={radius}
            fill="transparent"
            stroke={seg.color}
            strokeWidth="14"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-accumulated}
            strokeLinecap="butt"
            transform="rotate(-90 45 45)"
          />
        )
        accumulated += dash
        return circle
      })}
    </svg>
  )
}

function CostSummary({
  option,
  displayCurrencyId,
  tripCurrencyId,
  currencies,
  conversions,
  activeSortField,
}: {
  option: OptionApi
  displayCurrencyId: number | null
  tripCurrencyId: number | null
  currencies: Currency[]
  conversions: CurrencyConversion[]
  activeSortField?: string | null
}) {
  const split = useMemo(() => normalizeCostPerType(option.costPerType), [option.costPerType])
  const effectiveCurrencyId = displayCurrencyId ?? tripCurrencyId ?? null
  const primaryCurrencyId = effectiveCurrencyId ?? tripCurrencyId ?? null
  const totalDisplay = convertWithFallback({ amount: option.totalCost ?? 0, fromCurrencyId: tripCurrencyId ?? null, toCurrencyId: effectiveCurrencyId, conversions })
  const perDayDisplay = convertWithFallback({ amount: option.costPerDay ?? 0, fromCurrencyId: tripCurrencyId ?? null, toCurrencyId: effectiveCurrencyId, conversions })
  const totalLabel = formatCurrencyAmount(totalDisplay.amount, totalDisplay.currencyId ?? primaryCurrencyId, currencies)
  const perDayLabel = formatCurrencyAmount(perDayDisplay.amount, perDayDisplay.currencyId ?? primaryCurrencyId, currencies)
  const showOriginalTotal = displayCurrencyId !== null && tripCurrencyId !== null && tripCurrencyId !== displayCurrencyId && option.totalCost !== null
  const originalTotalLabel = showOriginalTotal ? formatCurrencyAmount(option.totalCost ?? 0, tripCurrencyId, currencies) : null
  const convertSplit = (v: number) => convertWithFallback({ amount: v, fromCurrencyId: tripCurrencyId ?? null, toCurrencyId: effectiveCurrencyId, conversions })
  const displaySplit = { Accommodation: convertSplit(split.Accommodation), Transport: convertSplit(split.Transport), Other: convertSplit(split.Other) }
  const splitLabel = (v: ReturnType<typeof convertSplit>) => formatCurrencyAmount(v.amount, v.currencyId ?? primaryCurrencyId, currencies)
  const legendEntries = [
    { key: "Transport", color: "hsl(var(--chart-1))", value: split.Transport, label: splitLabel(displaySplit.Transport) },
    { key: "Accommodation", color: "hsl(var(--chart-2))", value: split.Accommodation, label: splitLabel(displaySplit.Accommodation) },
    { key: "Other", color: "hsl(var(--chart-3))", value: split.Other, label: splitLabel(displaySplit.Other) },
  ].filter((e) => e.value > 0)

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className={cn("text-lg font-semibold", activeSortField === "totalCost" ? "sort-highlight" : "")}>{totalLabel}</div>
          {originalTotalLabel ? <span className="text-sm text-muted-foreground">({originalTotalLabel})</span> : null}
        </div>
        <div className={cn("text-xs text-muted-foreground", activeSortField === "totalDays" ? "sort-highlight" : "")}>
          {option.totalDays} {option.totalDays === 1 ? "day" : "days"} ({perDayLabel} per day)
        </div>
      </div>
      <div className="flex items-center gap-4">
        <CostPieChart accommodation={split.Accommodation} transport={split.Transport} other={split.Other} />
        <div className="space-y-2 text-xs text-muted-foreground">
          {legendEntries.length === 0 ? (
            <div>No categorized costs yet.</div>
          ) : (
            legendEntries.map((entry) => (
              <div key={entry.key} className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-sm ring-1 ring-black/10 dark:ring-white/40" style={{ backgroundColor: entry.color }} />
                <span className="text-foreground">{entry.key}</span> ({entry.label})
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function OptionCard({
  option,
  onEdit,
  onToggleVisibility,
  displayCurrencyId,
  tripCurrencyId,
  currencies,
  conversions,
  connectedSegments,
  allSegments,
  userPreferredOffset,
  isSelected = false,
  onToggleSelect,
  activeSortField,
}: {
  option: OptionApi
  onEdit: (option: OptionApi) => void
  onToggleVisibility: (option: OptionApi) => void
  displayCurrencyId: number | null
  tripCurrencyId: number | null
  currencies: Currency[]
  conversions: CurrencyConversion[]
  connectedSegments: ConnectedSegment[]
  allSegments: SegmentApi[]
  userPreferredOffset: number
  isSelected?: boolean
  onToggleSelect?: (optionId: number) => void
  activeSortField?: string | null
}) {
  const { openSegmentDetail } = useTripLayout()
  const [cardSegmentId, setCardSegmentId] = useState<number | null>(null)
  const [cardAnchorEl, setCardAnchorEl] = useState<HTMLDivElement | null>(null)

  // Look up the full segment data from allSegments (has complete fields: locations, cost, etc.)
  const cardSegment = useMemo(
    () => (cardSegmentId !== null ? (allSegments.find((s) => s.id === cardSegmentId) ?? null) : null),
    [cardSegmentId, allSegments],
  )
  // Get the segment type from connectedSegments (already has the type joined)
  const cardSegmentType = useMemo(
    () => (cardSegmentId !== null ? (connectedSegments.find((s) => s.id === cardSegmentId)?.segmentType ?? null) : null),
    [cardSegmentId, connectedSegments],
  )

  const isHidden = option.isUiVisible === false
  const sortedSegments = useMemo(
    () => [...connectedSegments].sort((a, b) => (a.startDateTimeUtc ?? "").localeCompare(b.startDateTimeUtc ?? "")),
    [connectedSegments]
  )

  const formatSegmentCost = useCallback((seg: SegmentApi) => {
    if (seg.cost === null || seg.cost === undefined) return null
    return (
      formatConvertedAmount({
        amount: seg.cost,
        fromCurrencyId: seg.currencyId ?? tripCurrencyId ?? null,
        toCurrencyId: displayCurrencyId ?? tripCurrencyId ?? null,
        currencies,
        conversions,
      }) ?? formatCurrencyAmount(seg.cost, seg.currencyId ?? tripCurrencyId ?? null, currencies)
    )
  }, [tripCurrencyId, displayCurrencyId, currencies, conversions])

  return (
    <>
      <Card
        className={cn(
          "hover:shadow-sm transition-all duration-200 ease-in-out border cursor-pointer hover:-translate-y-0.5",
          isHidden && "bg-muted text-muted-foreground border-muted-foreground/40",
          isSelected && "ring-2 ring-primary"
        )}
        onClick={() => onEdit(option)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onEdit(option) }}
        aria-label={`Edit option ${option.name}`}
      >
        <div className="flex flex-col">
          <div className="flex-1 min-w-0 p-4 pb-2">
            <div className="flex items-start">
              <div className="mr-2 mt-1" onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect?.(option.id)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-semibold tracking-tight">{option.name}</CardTitle>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground/80">
                  <div className={cn(activeSortField === "startDate" ? "sort-highlight" : "")}>{formatOptionDateWithWeekday(option.startDateTimeUtc, userPreferredOffset)}</div>
                  <div className={cn(activeSortField === "endDate" ? "sort-highlight" : "")}>{formatOptionDateWithWeekday(option.endDateTimeUtc, userPreferredOffset)}</div>
                </div>
                {sortedSegments.length > 0 && (
                  <div className="mt-2 flex items-center gap-1">
                    {(sortedSegments.length <= 6 ? sortedSegments : sortedSegments.slice(0, 5)).map((seg, i) =>
                      seg.segmentType?.iconSvg ? (
                        <button
                          key={`${seg.id}-${i}`}
                          type="button"
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary/60 text-secondary-foreground shadow-sm ring-1 ring-black/5 dark:bg-white dark:text-black hover:ring-2 hover:ring-primary/40 transition-all"
                          title={seg.segmentType.name}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (cardSegmentId === seg.id) {
                              setCardSegmentId(null)
                              setCardAnchorEl(null)
                            } else {
                              setCardSegmentId(seg.id)
                              setCardAnchorEl(e.currentTarget as unknown as HTMLDivElement)
                            }
                          }}
                        >
                          <span className="w-4 h-4" dangerouslySetInnerHTML={{ __html: seg.segmentType.iconSvg }} suppressHydrationWarning />
                        </button>
                      ) : null
                    )}
                    {sortedSegments.length > 6 && (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground shadow-sm ring-1 ring-black/5 text-xs font-medium" title={`${sortedSegments.length - 5} more segments`}>
                        +{sortedSegments.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0 ml-auto">
                <button
                  type="button"
                  className="rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
                  title={isHidden ? "Show option" : "Hide option"}
                  onClick={(e) => { e.stopPropagation(); onToggleVisibility(option) }}
                >
                  {isHidden ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                </button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(option) }} aria-label="Edit option">
                  <EditIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="px-4 pb-4 pt-3 border-t border-border/50">
            <CostSummary
              option={option}
              displayCurrencyId={displayCurrencyId}
              tripCurrencyId={tripCurrencyId}
              currencies={currencies}
              conversions={conversions}
              activeSortField={activeSortField}
            />
          </div>
        </div>
      </Card>

      <TimelineSegmentCard
        segment={cardSegment}
        segmentType={cardSegmentType}
        anchorEl={cardAnchorEl}
        formatSegmentCost={formatSegmentCost}
        onClose={() => { setCardSegmentId(null); setCardAnchorEl(null) }}
        onNavigateToSegment={openSegmentDetail}
      />
    </>
  )
}

// ---- main export ----

export interface OptionsListProps {
  tripId: number
  options: OptionApi[]
  connectedSegments: Record<number, ConnectedSegment[]>
  segments: SegmentApi[]
  segmentTypes: SegmentType[]
  currencies: Currency[]
  conversions: CurrencyConversion[]
  tripCurrencyId: number | null
  /** Resolved effective display currency (may differ from trip currency). */
  displayCurrencyId: number | null
  userPreferredOffset: number
  isLoading: boolean
  error: string | null
  /** Called when user clicks a card to edit, or the + button to create (null). */
  onEditOption: (option: OptionApi | null) => void
  /** Called after mutations so the parent can re-fetch. */
  onRefresh: () => void
}

export function OptionsList({
  tripId,
  options,
  connectedSegments,
  segments,
  segmentTypes,
  currencies,
  conversions,
  tripCurrencyId,
  displayCurrencyId,
  userPreferredOffset,
  isLoading,
  error,
  onEditOption,
  onRefresh,
}: OptionsListProps) {

  const [filterState, setFilterState] = useState<OptionFilterValue>({
    locations: [],
    dateRange: { start: "", end: "" },
    costMin: null,
    costMax: null,
    showHidden: false,
  })
  const [sortState, setSortState] = useState<OptionSortValue | null>(null)
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<number>>(new Set())
  const [isBatchConnectOpen, setIsBatchConnectOpen] = useState(false)
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)

  const sortedOptions = useMemo(
    () => applyOptionFilters(options, filterState, sortState, connectedSegments),
    [options, filterState, sortState, connectedSegments]
  )

  const optionMetadata = useMemo(() => {
    const segSource = Object.values(connectedSegments).flat().length
      ? Object.values(connectedSegments).flat()
      : segments
    return buildOptionMetadata(options, segSource as SegmentApi[])
  }, [options, connectedSegments, segments])

  const costChips = useMemo(() => computeCostChips(options.map((o) => o.totalCost ?? 0)), [options])
  const tripCurrencyLabel = useMemo(() => currencies.find((c) => c.id === tripCurrencyId)?.shortName ?? "", [currencies, tripCurrencyId])

  const toggleOptionSelection = useCallback((optionId: number) => {
    setSelectedOptionIds((prev) => {
      const next = new Set(prev)
      if (next.has(optionId)) next.delete(optionId)
      else next.add(optionId)
      return next
    })
  }, [])

  const handleBatchConnectComplete = useCallback(() => {
    setSelectedOptionIds(new Set())
    onRefresh()
  }, [onRefresh])

  const handleBatchDelete = useCallback(async () => {
    if (selectedOptionIds.size === 0) return
    if (!window.confirm(`Delete ${selectedOptionIds.size} option(s)? This cannot be undone.`)) return
    setIsBatchDeleting(true)
    try {
      await optionsApi.batchDelete(String(tripId), Array.from(selectedOptionIds))
      setSelectedOptionIds(new Set())
      onRefresh()
    } catch (err) {
      console.error("Batch delete failed:", err)
    } finally {
      setIsBatchDeleting(false)
    }
  }, [tripId, selectedOptionIds, onRefresh])

  const handleToggleVisibility = useCallback(async (option: OptionApi) => {
    const isHidden = option.isUiVisible === false
    if (!isHidden && !window.confirm(`Hide "${option.name}"?`)) return
    try {
      await optionsApi.batchSetVisibility(String(tripId), [option.id], isHidden)
      onRefresh()
    } catch (err) {
      console.error("Toggle visibility failed:", err)
    }
  }, [tripId, onRefresh])

  const handleBatchSetVisibility = useCallback(async (isVisible: boolean) => {
    if (selectedOptionIds.size === 0) return
    try {
      await optionsApi.batchSetVisibility(String(tripId), Array.from(selectedOptionIds), isVisible)
      setSelectedOptionIds(new Set())
      onRefresh()
    } catch (err) {
      console.error("Batch visibility failed:", err)
    }
  }, [tripId, selectedOptionIds, onRefresh])

  return (
    <>
      <div className="sticky top-0 z-10 bg-background -mx-4 px-4 pb-2 border-b">
        <OptionFilterPanel
          value={filterState}
          onChange={setFilterState}
          sort={sortState}
          onSortChange={setSortState}
          availableLocations={optionMetadata.locations}
          minDate={optionMetadata.dateBounds.min}
          maxDate={optionMetadata.dateBounds.max}
          uniqueStartDates={optionMetadata.uniqueStartDates}
          uniqueEndDates={optionMetadata.uniqueEndDates}
          totalCount={options.length}
          filteredCount={sortedOptions.length}
          hiddenCount={options.filter((o) => o.isUiVisible === false).length}
          costMinChips={costChips.minChips}
          costMaxChips={costChips.maxChips}
          allSameCost={costChips.allSameCost}
          currencyLabel={tripCurrencyLabel}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 mt-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-56 w-full" />)}
        </div>
      ) : error ? (
        <p className="text-center text-red-500 mt-4">{error}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 mt-4">
          {sortedOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-full text-center">No options to display.</p>
          ) : (
            sortedOptions.map((option) => (
              <div key={option.id} className="animate-in fade-in slide-in-from-top-2 duration-500">
                <OptionCard
                  option={option}
                  onEdit={onEditOption}
                  onToggleVisibility={handleToggleVisibility}
                  displayCurrencyId={displayCurrencyId}
                  tripCurrencyId={tripCurrencyId}
                  currencies={currencies}
                  conversions={conversions}
                  connectedSegments={connectedSegments[option.id] ?? []}
                  allSegments={segments}
                  userPreferredOffset={userPreferredOffset}
                  isSelected={selectedOptionIds.has(option.id)}
                  onToggleSelect={toggleOptionSelection}
                  activeSortField={sortState?.field}
                />
              </div>
            ))
          )}
        </div>
      )}

      <BatchConnectSegmentModal
        isOpen={isBatchConnectOpen}
        onClose={() => setIsBatchConnectOpen(false)}
        onComplete={handleBatchConnectComplete}
        selectedOptionIds={Array.from(selectedOptionIds)}
        tripId={tripId}
        segments={segments}
        segmentTypes={segmentTypes}
        currencies={currencies}
        conversions={conversions}
        tripCurrencyId={tripCurrencyId}
        displayCurrencyId={displayCurrencyId}
      />

      <SelectPopupMenu
        selectedCount={selectedOptionIds.size}
        totalCount={sortedOptions.length}
        onSelectAll={() => setSelectedOptionIds(new Set(sortedOptions.map((o) => o.id)))}
        onHide={() => handleBatchSetVisibility(false)}
        onShow={() => handleBatchSetVisibility(true)}
        onDelete={handleBatchDelete}
        isDeleting={isBatchDeleting}
        onClear={() => setSelectedOptionIds(new Set())}
        extraActions={[
          {
            icon: <LinkIcon className="h-4 w-4" />,
            label: "Connect / Disconnect Segment",
            onClick: () => setIsBatchConnectOpen(true),
          },
        ]}
      />
    </>
  )
}
