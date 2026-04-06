"use client"

import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { toast } from "../ui/use-toast"
import type { SegmentApi, SegmentType } from "../../types/models"
import type { Stage } from "../../types/stages"
import type { PanelMode } from "../../trip/[tripId]/TripLayoutContext"
import type { useStageBuilder } from "../../hooks/useStageBuilder"
import { assignLanes, toPercent } from "./useTimelineLanes"
import { TimelineBar, LANE_HEIGHT, LANE_GAP_PX } from "./TimelineBar"
import { TimelineAxis } from "./TimelineAxis"
import { TimelineStageMarkers } from "./TimelineStageMarkers"
import { TimelineSegmentCard } from "./TimelineSegmentCard"
import { segmentColor } from "../../utils/segmentVisuals"
import { useTripLayout } from "../../trip/[tripId]/TripLayoutContext"
import { cn } from "../../lib/utils"

const MS_DAY = 86_400_000
const PAGINATED_WINDOW_DAYS = 29  // window size when trip is too long to show all at once
const PAGINATION_THRESHOLD = 29   // trips longer than this get pagination

type StageBuilderReturn = ReturnType<typeof useStageBuilder>

interface SegmentTimelineProps {
  segments: SegmentApi[]
  segmentTypes: SegmentType[]
  selectedSegmentIds: number[]
  onToggleSegment: (segmentId: number, checked: boolean) => void
  stages: Stage[]
  stageBuilder: StageBuilderReturn
  formatSegmentCost: (seg: SegmentApi) => string | null
  panelMode: PanelMode
  startingLocationKey: string | null
  optionName: string
  loading?: boolean
}

export function SegmentTimeline({
  segments,
  segmentTypes,
  selectedSegmentIds,
  onToggleSegment,
  stages,
  stageBuilder,
  formatSegmentCost,
  panelMode,
  startingLocationKey,
  optionName,
  loading,
}: SegmentTimelineProps) {
  const { openSegmentDetail } = useTripLayout()
  const [activeCardSegmentId, setActiveCardSegmentId] = useState<number | null>(null)
  const [activeCardAnchorEl, setActiveCardAnchorEl] = useState<HTMLDivElement | null>(null)
  const [windowStart, setWindowStart] = useState<number | null>(null)
  const [hiddenTypeIds, setHiddenTypeIds] = useState<Set<number>>(new Set())

  const scrollRef1 = useRef<HTMLDivElement>(null)
  const scrollRef2 = useRef<HTMLDivElement>(null)
  const isSyncing = useRef(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isTouch = panelMode !== "desktop"
  const laneH = isTouch ? LANE_HEIGHT.touch : LANE_HEIGHT.desktop

  const selectedSet = useMemo(() => new Set(selectedSegmentIds), [selectedSegmentIds])

  const segmentMap = useMemo(() => {
    const m = new Map<number, SegmentApi>()
    segments.forEach((s) => m.set(s.id, s))
    return m
  }, [segments])

  // Data bounds
  const { dataStart, dataEnd, undatedIds } = useMemo(() => {
    const undated = new Set<number>()
    let minMs = Infinity
    let maxMs = -Infinity
    for (const seg of segments) {
      if (!seg.startDateTimeUtc || !seg.endDateTimeUtc) {
        undated.add(seg.id)
        continue
      }
      const s = new Date(seg.startDateTimeUtc).getTime()
      const e = new Date(seg.endDateTimeUtc).getTime()
      if (s < minMs) minMs = s
      if (e > maxMs) maxMs = e
    }
    return {
      dataStart: minMs === Infinity ? null : minMs,
      dataEnd: maxMs === -Infinity ? null : maxMs,
      undatedIds: undated,
    }
  }, [segments])

  // Window size in days:
  // - trips ≤ 28 days: show all days + 1 padding on each side, no pagination
  // - trips ≥ 29 days: fixed 29-day window, paginate with prev/next buttons
  const tripDays = useMemo(() => {
    if (dataStart === null || dataEnd === null) return 5
    const rawDays = Math.ceil((dataEnd - dataStart) / MS_DAY)
    if (rawDays < PAGINATION_THRESHOLD) return rawDays + 2  // show full trip + 1 day padding each side
    return PAGINATED_WINDOW_DAYS
  }, [dataStart, dataEnd])

  const VISIBLE_DAYS = 5
  const windowMs = tripDays * MS_DAY
  const widthFactor = tripDays / VISIBLE_DAYS

  // Initialize window start: 1 day before earliest segment (padding day)
  useEffect(() => {
    if (dataStart === null) return
    setWindowStart((prev) => {
      if (prev !== null) return prev
      const d = new Date(dataStart)
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - MS_DAY
    })
  }, [dataStart])

  const effectiveWindowStart = useMemo(() => {
    if (windowStart !== null) return windowStart
    if (dataStart === null) return 0
    const d = new Date(dataStart)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - MS_DAY
  }, [windowStart, dataStart])

  const effectiveWindowEnd = effectiveWindowStart + windowMs

  // Reset scroll when window shifts
  useEffect(() => {
    if (scrollRef1.current) scrollRef1.current.scrollLeft = 0
    if (scrollRef2.current) scrollRef2.current.scrollLeft = 0
  }, [effectiveWindowStart])

  const viewportLayout = useMemo(
    () => ({
      windowStart: effectiveWindowStart,
      windowEnd: effectiveWindowEnd,
      range: windowMs,
      laneAssignment: new Map<number, number>(),
      laneCount: 0,
      undatedIds,
    }),
    [effectiveWindowStart, effectiveWindowEnd, windowMs, undatedIds],
  )

  // Scroll sync between sections
  const handleScroll1 = useCallback(() => {
    if (isSyncing.current || !scrollRef1.current || !scrollRef2.current) return
    isSyncing.current = true
    scrollRef2.current.scrollLeft = scrollRef1.current.scrollLeft
    requestAnimationFrame(() => { isSyncing.current = false })
  }, [])

  const handleScroll2 = useCallback(() => {
    if (isSyncing.current || !scrollRef1.current || !scrollRef2.current) return
    isSyncing.current = true
    scrollRef1.current.scrollLeft = scrollRef2.current.scrollLeft
    requestAnimationFrame(() => { isSyncing.current = false })
  }, [])

  // Segment splits
  const selectedSegs = useMemo(
    () => segments.filter((s) => !undatedIds.has(s.id) && selectedSet.has(s.id)),
    [segments, undatedIds, selectedSet],
  )

  const availableTypes = useMemo(() => {
    const typeIds = new Set(
      segments.filter((s) => !undatedIds.has(s.id) && !selectedSet.has(s.id)).map((s) => s.segmentTypeId),
    )
    return segmentTypes.filter((st) => typeIds.has(st.id))
  }, [segments, undatedIds, selectedSet, segmentTypes])

  const unselectedSegs = useMemo(
    () =>
      segments.filter(
        (s) =>
          !undatedIds.has(s.id) &&
          !selectedSet.has(s.id) &&
          (hiddenTypeIds.size === 0 || !hiddenTypeIds.has(s.segmentTypeId)),
      ),
    [segments, undatedIds, selectedSet, hiddenTypeIds],
  )

  const selectedInWindow = useMemo(
    () =>
      selectedSegs.filter((s) => {
        const start = new Date(s.startDateTimeUtc).getTime()
        const end = new Date(s.endDateTimeUtc).getTime()
        return start < effectiveWindowEnd && end > effectiveWindowStart
      }),
    [selectedSegs, effectiveWindowStart, effectiveWindowEnd],
  )

  const unselectedInWindow = useMemo(
    () =>
      unselectedSegs.filter((s) => {
        const start = new Date(s.startDateTimeUtc).getTime()
        const end = new Date(s.endDateTimeUtc).getTime()
        return start < effectiveWindowEnd && end > effectiveWindowStart
      }),
    [unselectedSegs, effectiveWindowStart, effectiveWindowEnd],
  )

  const selectedLanes = useMemo(() => assignLanes(selectedInWindow), [selectedInWindow])
  const unselectedLanes = useMemo(() => assignLanes(unselectedInWindow), [unselectedInWindow])

  // Nav buttons only shown for paginated trips (≥ 29 days) and only when segments exist in that direction
  const isPaginated = tripDays === PAGINATED_WINDOW_DAYS
  const showPrev = isPaginated && dataStart !== null && effectiveWindowStart > dataStart - MS_DAY
  const showNext = isPaginated && dataEnd !== null && effectiveWindowEnd < dataEnd + MS_DAY

  const prevDay = useCallback(() => setWindowStart(effectiveWindowStart - MS_DAY), [effectiveWindowStart])
  const nextDay = useCallback(() => setWindowStart(effectiveWindowStart + MS_DAY), [effectiveWindowStart])

  // Card open/close
  const openCard = useCallback((id: number, el: HTMLDivElement) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setActiveCardSegmentId(id)
    setActiveCardAnchorEl(el)
  }, [])

  const closeCard = useCallback(() => {
    setActiveCardSegmentId(null)
    setActiveCardAnchorEl(null)
  }, [])

  const scheduleCloseCard = useCallback(() => {
    hideTimerRef.current = setTimeout(closeCard, 150)
  }, [closeCard])

  const cancelCloseCard = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
  }, [])

  const handleBarMouseEnter = useCallback((_id: number, _el: HTMLDivElement) => {}, [])
  const handleBarMouseLeave = useCallback(() => {}, [])

  const handleBarClick = useCallback(
    (id: number, el: HTMLDivElement) => {
      // Always open the card — user confirms via Add/Remove button
      if (activeCardSegmentId === id) closeCard()
      else openCard(id, el)
    },
    [activeCardSegmentId, closeCard, openCard],
  )

  const handleCardToggle = useCallback(
    (segmentId: number) => {
      if (!startingLocationKey) {
        toast({
          title: "Pick a starting location first",
          description: "Use the dropdown above to choose where your trip begins.",
        })
        return
      }
      onToggleSegment(segmentId, !selectedSet.has(segmentId))
    },
    [startingLocationKey, selectedSet, onToggleSegment],
  )

  const activeCardSegment = activeCardSegmentId !== null ? segmentMap.get(activeCardSegmentId) ?? null : null
  const activeCardSegmentType = activeCardSegment
    ? segmentTypes.find((st) => st.id === activeCardSegment.segmentTypeId) ?? null
    : null

  // Hover highlight (desktop only)
  const hoverHighlight = useMemo(() => {
    if (isTouch || !activeCardSegment || !activeCardSegment.startDateTimeUtc || !activeCardSegment.endDateTimeUtc)
      return null
    const startMs = new Date(activeCardSegment.startDateTimeUtc).getTime()
    const endMs = new Date(activeCardSegment.endDateTimeUtc).getTime()
    const leftPct = toPercent(startMs, viewportLayout)
    const rightPct = toPercent(endMs, viewportLayout)
    return { leftPct, widthPct: Math.max(1.5, rightPct - leftPct) }
  }, [isTouch, activeCardSegment, viewportLayout])

  const toggleType = useCallback((typeId: number) => {
    setHiddenTypeIds((prev) => {
      const next = new Set(prev)
      if (next.has(typeId)) next.delete(typeId)
      else next.add(typeId)
      return next
    })
  }, [])

  const undatedCount = undatedIds.size
  const hasAnyDated = segments.some((s) => !undatedIds.has(s.id))

  if (!hasAnyDated && undatedCount === 0 && !loading) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No segments to show.</p>
  }

  // Minimum bar width so icon is always legible: icon is 20px, needs ~24px bar minimum.
  // We express this as a percentage of the full window width.
  // We don't know the pixel container width, so we use a conservative MIN_WIDTH_PCT.
  // 24px / (typical container ~400px) = 6% of window.  With widthFactor applied,
  // the *visible* container is windowMs/VISIBLE_DAYS wide, so the percent in the
  // full canvas is 6% / widthFactor. We clamp at 0.5% to avoid being too aggressive on wide screens.
  const MIN_BAR_WIDTH_PCT_CANVAS = Math.max(0.5, 6 / widthFactor)

  const innerStyle: React.CSSProperties = { width: `${widthFactor * 100}%` }

  const renderBars = (
    segsInWindow: SegmentApi[],
    lanes: { laneAssignment: Map<number, number>; laneCount: number },
  ) => {
    const totalHeight = lanes.laneCount * (laneH + LANE_GAP_PX)
    if (lanes.laneCount === 0) {
      return (
        <div className="h-8 flex items-center text-xs text-muted-foreground/50 pl-2">
          None in this period
        </div>
      )
    }
    return (
      <div className="relative overflow-hidden" style={{ height: totalHeight }}>
        {stages.length > 0 && (
          <TimelineStageMarkers
            stages={stages}
            segmentMap={segmentMap}
            layout={viewportLayout}
            laneCount={lanes.laneCount}
            laneHeight={laneH}
            laneGap={LANE_GAP_PX}
            variant="backgrounds"
          />
        )}
        {hoverHighlight && (
          <div
            className="absolute inset-y-0 bg-primary/10 rounded pointer-events-none z-0"
            style={{ left: `${hoverHighlight.leftPct}%`, width: `${hoverHighlight.widthPct}%` }}
          />
        )}
        {segsInWindow.map((seg) => {
          const lane = lanes.laneAssignment.get(seg.id) ?? 0
          const segType = segmentTypes.find((st) => st.id === seg.segmentTypeId) ?? null
          return (
            <TimelineBar
              key={seg.id}
              segment={seg}
              segmentType={segType}
              lane={lane}
              viewportStart={effectiveWindowStart}
              viewportRange={windowMs}
              minWidthPct={MIN_BAR_WIDTH_PCT_CANVAS}
              selected={selectedSet.has(seg.id)}
              hovered={activeCardSegmentId === seg.id}
              dimmed={seg.isUiVisible === false}
              onMouseEnter={handleBarMouseEnter}
              onMouseLeave={handleBarMouseLeave}
              onClick={handleBarClick}
              panelMode={panelMode}
            />
          )
        })}
      </div>
    )
  }

  const navButtons = (showPrev || showNext) && (
    <div className="flex items-center justify-between pt-1">
      <button
        type="button"
        onClick={prevDay}
        disabled={!showPrev}
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
          showPrev ? "hover:bg-muted text-foreground" : "invisible",
        )}
        aria-label="Previous day"
      >
        <ChevronLeftIcon className="h-3.5 w-3.5" />
        Prev day
      </button>
      <button
        type="button"
        onClick={nextDay}
        disabled={!showNext}
        className={cn(
          "flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors",
          showNext ? "hover:bg-muted text-foreground" : "invisible",
        )}
        aria-label="Next day"
      >
        Next day
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )

  return (
    <div className="space-y-2">
      {/* Loading bar */}
      {loading && (
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-muted relative">
          <div
            className="absolute h-full bg-primary/60 rounded-full"
            style={{ width: "40%", animation: "timeline-shimmer 1.4s ease-in-out infinite" }}
          />
          <style>{`@keyframes timeline-shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}`}</style>
        </div>
      )}

      {/* Selected section */}
      {selectedSegs.length > 0 && (
        <div>
          {/* Sticky section header */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-1 px-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
              Selected
            </span>
          </div>
          <div
            ref={scrollRef1}
            className="overflow-x-auto"
            style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
            onScroll={handleScroll1}
          >
            <div style={innerStyle}>
              {stages.length > 0 && (
                <TimelineStageMarkers
                  stages={stages}
                  segmentMap={segmentMap}
                  layout={viewportLayout}
                  laneCount={0}
                  laneHeight={laneH}
                  laneGap={LANE_GAP_PX}
                  variant="labels"
                />
              )}
              {renderBars(selectedInWindow, selectedLanes)}
            </div>
          </div>
          {navButtons}
        </div>
      )}

      {/* Type filter chips */}
      {availableTypes.length > 1 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {availableTypes.map((type) => {
            const active = !hiddenTypeIds.has(type.id)
            const color = segmentColor(type)
            return (
              <button
                key={type.id}
                type="button"
                onClick={() => toggleType(type.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors select-none",
                  active
                    ? "bg-muted border-border text-foreground"
                    : "bg-muted/30 border-border/40 text-muted-foreground line-through",
                )}
              >
                {type.iconSvg ? (
                  <span
                    className="w-3.5 h-3.5 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-zinc-700 dark:[&>svg]:fill-zinc-100"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: type.iconSvg }}
                    suppressHydrationWarning
                  />
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: active ? color : undefined }} />
                )}
                {type.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Available section */}
      <div>
        {/* Sticky section header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-1 px-0.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">
            Available
          </span>
        </div>
        <div
          ref={scrollRef2}
          className="overflow-x-auto"
          style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          onScroll={handleScroll2}
        >
          <div style={innerStyle}>
            {selectedSegs.length === 0 && stages.length > 0 && (
              <TimelineStageMarkers
                stages={stages}
                segmentMap={segmentMap}
                layout={viewportLayout}
                laneCount={0}
                laneHeight={laneH}
                laneGap={LANE_GAP_PX}
                variant="labels"
              />
            )}
            {renderBars(unselectedInWindow, unselectedLanes)}
            <TimelineAxis viewportStart={effectiveWindowStart} viewportEnd={effectiveWindowEnd} />
          </div>
        </div>
        {navButtons}
      </div>

      {undatedCount > 0 && (
        <p className="text-xs text-muted-foreground pt-1">
          {undatedCount} segment{undatedCount !== 1 ? "s" : ""} without dates not shown — use List view to select them.
        </p>
      )}

      <TimelineSegmentCard
        segment={activeCardSegment}
        segmentType={activeCardSegmentType}
        anchorEl={activeCardAnchorEl}
        formatSegmentCost={formatSegmentCost}
        selected={activeCardSegmentId !== null && selectedSet.has(activeCardSegmentId)}
        optionName={optionName}
        onToggle={handleCardToggle}
        onClose={closeCard}
        onNavigateToSegment={openSegmentDetail}
        onMouseEnter={undefined}
        onMouseLeave={undefined}
      />
    </div>
  )
}
