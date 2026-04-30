// SegmentsList.tsx
// Reusable filter panel + card grid for segments.
// Used by SegmentsPageContent (legacy route) and TripPageContent (new 3-panel route).
"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { Card, CardHeader, CardTitle } from "../components/ui/card"
import { Skeleton } from "../components/ui/skeleton"
import { Button } from "../components/ui/button"
import { EditIcon, EyeIcon, EyeOffIcon, Loader2Icon, MapPinIcon } from "lucide-react"
import { Checkbox } from "../components/ui/checkbox"
import SelectPopupMenu from "../components/SelectPopupMenu"
import BatchLocationModal from "./BatchLocationModal"
import { OptionBadge } from "../components/OptionBadge"
import { cn } from "../lib/utils"
import { SegmentFilterPanel, useSegmentFilterHasFilters, type SegmentFilterValue } from "../components/filters/SegmentFilterPanel"
import type { SegmentSortValue } from "../components/sorting/segmentSortTypes"
import { applySegmentFilters, buildSegmentMetadata } from "../services/segmentFiltering"
import { computeCostChips } from "../components/filters/costChips"
import { segmentsApi } from "../utils/apiClient"
import { formatCurrencyAmount, convertWithFallback } from "../utils/currency"
import { formatDateWithUserOffset, formatWeekday } from "../utils/dateformatters"
import type { Segment, SegmentType, OptionRef, Currency, CurrencyConversion } from "../types/models"
import { buildSegmentTitleTokens, buildSegmentConfigFromApi, getSegmentNickname, tokensToLabel } from "../utils/formatters"
import { TitleTokens } from "../components/TitleTokens"

// ---- local helpers ----

const getLocationLabel = (loc: any | null) => {
  if (!loc) return ""
  const name = loc.name ?? ""
  const country = loc.country ?? ""
  return country ? `${name}, ${country}` : name
}

const formatSegmentDateWithWeekday = (iso: string, offset: number) => {
  const weekday = formatWeekday(iso, offset)
  return `${weekday}, ${formatDateWithUserOffset(iso, offset)}`
}

const sortHighlight = "sort-highlight"

// ---- SegmentCard ----

function SegmentCard({
  segment,
  segmentType,
  userPreferredOffset,
  onEdit,
  onToggleVisibility,
  connectedOptions,
  isLoadingConnections,
  displayCurrencyId,
  tripCurrencyId,
  currencies,
  conversions,
  isSelected = false,
  onToggleSelect,
  activeSortField,
}: {
  segment: Segment
  segmentType: SegmentType | undefined
  userPreferredOffset: number
  onEdit: (segment: Segment) => void
  onToggleVisibility: (segment: Segment) => void
  connectedOptions: OptionRef[]
  isLoadingConnections: boolean
  displayCurrencyId: number | null
  tripCurrencyId: number | null
  currencies: Currency[]
  conversions: CurrencyConversion[]
  isSelected?: boolean
  onToggleSelect?: (segmentId: number) => void
  activeSortField?: string | null
}) {
  const startLoc = (segment as any).startLocation ?? null
  const endLoc = (segment as any).endLocation ?? null
  const isHidden = segment.isUiVisible === false
  const numericCost = Number(segment.cost ?? 0)
  const desiredCurrencyId = displayCurrencyId ?? tripCurrencyId ?? segment.currencyId ?? null
  const primaryDisplay = convertWithFallback({ amount: numericCost, fromCurrencyId: segment.currencyId ?? null, toCurrencyId: desiredCurrencyId, conversions })
  const primaryLabel = formatCurrencyAmount(primaryDisplay.amount, primaryDisplay.currencyId, currencies)
  const originalLabel = formatCurrencyAmount(numericCost, segment.currencyId, currencies)
  const showOriginalCost = displayCurrencyId !== null && segment.currencyId !== null && segment.currencyId !== undefined && segment.currencyId !== displayCurrencyId

  return (
    <Card
      className={cn(
        "cursor-pointer hover:bg-muted/50 transition-all duration-200 ease-in-out hover:-translate-y-0.5",
        isHidden && "bg-muted text-muted-foreground border-muted-foreground/40",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={() => onEdit(segment)}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center mr-3 mt-1" onClick={(e) => e.stopPropagation()}>
            <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect?.(segment.id)} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {isLoadingConnections ? (
                <span className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2Icon className="h-3 w-3 animate-spin" />
                  Loading options…
                </span>
              ) : connectedOptions?.length ? (
                connectedOptions.map((option) => {
                  const optionHidden = (option as any)?.isUiVisible === false
                  return <OptionBadge key={option.id} id={option.id} name={option.name} isHidden={optionHidden} />
                })
              ) : (
                <span className="text-xs text-muted-foreground">No connected options</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm font-medium mb-0.5">
              <TitleTokens tokens={buildSegmentTitleTokens(buildSegmentConfigFromApi(segment, segmentType))} />
            </div>
            {getSegmentNickname(segment.name) && (
              <p className="text-xs text-muted-foreground italic truncate">"{getSegmentNickname(segment.name)}"</p>
            )}
            <div className="mt-2 text-sm text-muted-foreground space-y-1">
              <div className={cn(activeSortField === "startDate" || activeSortField === "startLocation" ? sortHighlight : "")}>
                {formatSegmentDateWithWeekday(segment.startDateTimeUtc, userPreferredOffset)}
                {startLoc ? ` (${getLocationLabel(startLoc)})` : ""}
              </div>
              <div className={cn(activeSortField === "endDate" || activeSortField === "endLocation" ? sortHighlight : "")}>
                {formatSegmentDateWithWeekday(segment.endDateTimeUtc, userPreferredOffset)}
                {endLoc ? ` (${getLocationLabel(endLoc)})` : ""}
              </div>
              <div className={cn("font-medium text-foreground", activeSortField === "cost" ? sortHighlight : "")}>
                {primaryLabel}
                {showOriginalCost ? <span className="ml-2 text-xs text-muted-foreground">({originalLabel})</span> : null}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 ml-4">
            <button
              type="button"
              className="rounded-full p-1 text-muted-foreground hover:text-foreground transition-colors"
              title={isHidden ? "Show segment" : "Hide segment"}
              onClick={(e) => { e.stopPropagation(); onToggleVisibility(segment) }}
            >
              {isHidden ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
            </button>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onEdit(segment) }}>
              <EditIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
    </Card>
  )
}

// ---- main export ----

export interface SegmentsListProps {
  tripId: number
  segments: Segment[]
  segmentTypes: SegmentType[]
  currencies: Currency[]
  conversions: CurrencyConversion[]
  tripCurrencyId: number | null
  /** Resolved effective display currency. */
  displayCurrencyId: number | null
  userPreferredOffset: number
  userPreferredCurrencyId: number | null
  isLoading: boolean
  error: string | null
  /** Called when user clicks a card (edit) or null (create). */
  onEditSegment: (segment: Segment | null) => void
  /** Called after mutations so the parent can re-fetch. */
  onRefresh: () => void
}

export function SegmentsList({
  tripId,
  segments,
  segmentTypes,
  currencies,
  conversions,
  tripCurrencyId,
  displayCurrencyId,
  userPreferredOffset,
  userPreferredCurrencyId,
  isLoading,
  error,
  onEditSegment,
  onRefresh,
}: SegmentsListProps) {
  const [filterState, setFilterState] = useState<SegmentFilterValue>({
    locations: [],
    types: [],
    dateRange: { start: "", end: "" },
    costMin: null,
    costMax: null,
    showHidden: false,
  })
  const [sortState, setSortState] = useState<SegmentSortValue | null>(null)
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<Set<number>>(new Set())
  const [isBatchLocationOpen, setIsBatchLocationOpen] = useState(false)
  const [isBatchDeleting, setIsBatchDeleting] = useState(false)
  const [connectedBySegment, setConnectedBySegment] = useState<Record<number, OptionRef[]>>({})
  const [connectionsLoading, setConnectionsLoading] = useState<Record<number, boolean>>({})

  // Fetch connected options for each segment when segments change
  useEffect(() => {
    if (!segments.length) {
      setConnectionsLoading({})
      setConnectedBySegment({})
      return
    }
    let cancelled = false
    const loadingFlags: Record<number, boolean> = {}
    segments.forEach((seg) => { loadingFlags[seg.id] = true })
    setConnectionsLoading(loadingFlags)

    const fetches = segments.map(async (seg) => {
      try {
        const options = await segmentsApi.getConnectedOptions(tripId, seg.id)
        if (cancelled) return
        setConnectedBySegment((prev) => ({ ...prev, [seg.id]: options }))
      } catch (err) {
        if (!cancelled) console.warn("Connected options fetch failed:", err)
      } finally {
        if (cancelled) return
        setConnectionsLoading((prev) => {
          const next = { ...prev }
          delete next[seg.id]
          return next
        })
      }
    })
    void Promise.allSettled(fetches)
    return () => { cancelled = true }
  }, [segments, tripId])

  const effectiveDisplayCurrencyId = displayCurrencyId ?? tripCurrencyId ?? userPreferredCurrencyId ?? null

  const sortedSegments = useMemo(() => {
    return applySegmentFilters(segments, filterState, sortState, segmentTypes, {
      targetCurrencyId: effectiveDisplayCurrencyId,
      fallbackCurrencyId: tripCurrencyId ?? userPreferredCurrencyId ?? null,
      currencies,
      conversions,
    })
  }, [segments, filterState, sortState, segmentTypes, effectiveDisplayCurrencyId, tripCurrencyId, userPreferredCurrencyId, currencies, conversions])

  const segmentMetadata = useMemo(
    () => buildSegmentMetadata(segments, segmentTypes, filterState),
    [segments, segmentTypes, filterState],
  )
  const costChips = useMemo(() => computeCostChips(segments.map((s) => Number(s.cost) || 0)), [segments])
  const tripCurrencyLabel = useMemo(() => currencies.find((c) => c.id === tripCurrencyId)?.shortName ?? "", [currencies, tripCurrencyId])

  const toggleSegmentSelection = useCallback((segmentId: number) => {
    setSelectedSegmentIds((prev) => {
      const next = new Set(prev)
      if (next.has(segmentId)) next.delete(segmentId)
      else next.add(segmentId)
      return next
    })
  }, [])

  const handleBatchLocationComplete = useCallback(() => {
    setSelectedSegmentIds(new Set())
    onRefresh()
  }, [onRefresh])

  const handleBatchDelete = useCallback(async () => {
    if (selectedSegmentIds.size === 0) return
    if (!window.confirm(`Delete ${selectedSegmentIds.size} segment(s)? This cannot be undone.`)) return
    setIsBatchDeleting(true)
    try {
      await segmentsApi.batchDelete(String(tripId), Array.from(selectedSegmentIds))
      setSelectedSegmentIds(new Set())
      onRefresh()
    } catch (err) {
      console.error("Batch delete failed:", err)
    } finally {
      setIsBatchDeleting(false)
    }
  }, [tripId, selectedSegmentIds, onRefresh])

  const handleToggleVisibility = useCallback(async (segment: Segment) => {
    const isHidden = segment.isUiVisible === false
    if (!isHidden) {
      const st = segmentTypes.find((t) => t.id === segment.segmentTypeId)
      const label = tokensToLabel(buildSegmentTitleTokens(buildSegmentConfigFromApi(segment, st ?? undefined))) || "this segment"
      if (!window.confirm(`Hide "${label}"?`)) return
    }
    try {
      await segmentsApi.batchSetVisibility(String(tripId), [segment.id], isHidden)
      onRefresh()
    } catch (err) {
      console.error("Toggle visibility failed:", err)
    }
  }, [tripId, onRefresh])

  const handleBatchSetVisibility = useCallback(async (isVisible: boolean) => {
    if (selectedSegmentIds.size === 0) return
    try {
      await segmentsApi.batchSetVisibility(String(tripId), Array.from(selectedSegmentIds), isVisible)
      setSelectedSegmentIds(new Set())
      onRefresh()
    } catch (err) {
      console.error("Batch visibility failed:", err)
    }
  }, [tripId, selectedSegmentIds, onRefresh])

  return (
    <>
      <div className="sticky top-0 z-10 bg-background -mx-4 px-4 pb-2 border-b">
        <SegmentFilterPanel
          value={filterState}
          onChange={setFilterState}
          sort={sortState}
          onSortChange={setSortState}
          availableLocations={segmentMetadata.locations}
          availableTypes={segmentMetadata.types}
          minDate={segmentMetadata.dateBounds.min}
          maxDate={segmentMetadata.dateBounds.max}
          uniqueStartDates={segmentMetadata.uniqueStartDates}
          uniqueEndDates={segmentMetadata.uniqueEndDates}
          totalCount={segments.length}
          filteredCount={sortedSegments.length}
          hiddenCount={segments.filter((s) => s.isUiVisible === false).length}
          costMinChips={costChips.minChips}
          costMaxChips={costChips.maxChips}
          allSameCost={costChips.allSameCost}
          currencyLabel={tripCurrencyLabel}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 mt-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : error ? (
        <p className="text-center text-red-500 mt-4">{error}</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 mt-2">
          {sortedSegments.length === 0 ? (
            <p className="text-sm text-muted-foreground col-span-full text-center">No segments to display.</p>
          ) : (
            sortedSegments.map((segment) => (
              <div key={segment.id} className="animate-in fade-in slide-in-from-top-2 duration-500">
                <SegmentCard
                  segment={segment}
                  segmentType={segmentTypes.find((st) => st.id === segment.segmentTypeId)}
                  userPreferredOffset={userPreferredOffset}
                  onEdit={onEditSegment}
                  onToggleVisibility={handleToggleVisibility}
                  connectedOptions={connectedBySegment[segment.id] ?? []}
                  isLoadingConnections={!!connectionsLoading[segment.id]}
                  displayCurrencyId={effectiveDisplayCurrencyId}
                  tripCurrencyId={tripCurrencyId}
                  currencies={currencies}
                  conversions={conversions}
                  isSelected={selectedSegmentIds.has(segment.id)}
                  onToggleSelect={toggleSegmentSelection}
                  activeSortField={sortState?.field}
                />
              </div>
            ))
          )}
        </div>
      )}

      <BatchLocationModal
        isOpen={isBatchLocationOpen}
        onClose={() => setIsBatchLocationOpen(false)}
        onComplete={handleBatchLocationComplete}
        selectedSegmentIds={Array.from(selectedSegmentIds)}
        tripId={tripId}
      />

      <SelectPopupMenu
        selectedCount={selectedSegmentIds.size}
        totalCount={sortedSegments.length}
        onSelectAll={() => setSelectedSegmentIds(new Set(sortedSegments.map((s) => s.id)))}
        onHide={() => handleBatchSetVisibility(false)}
        onShow={() => handleBatchSetVisibility(true)}
        onDelete={handleBatchDelete}
        isDeleting={isBatchDeleting}
        onClear={() => setSelectedSegmentIds(new Set())}
        extraActions={[
          {
            icon: <MapPinIcon className="h-4 w-4" />,
            label: "Edit locations",
            onClick: () => setIsBatchLocationOpen(true),
            variant: "default",
          },
        ]}
      />
    </>
  )
}
