"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type { SegmentApi, SegmentType, Currency, CurrencyConversion } from "../../types/models"
import { useItineraryData, type ItineraryLocation, type ItineraryArc } from "../../hooks/useItineraryData"
import { ItineraryGlobe } from "./ItineraryGlobe"
import { ItineraryCostBreakdown } from "./ItineraryCostBreakdown"
import { TimelineSegmentCard } from "../timeline/TimelineSegmentCard"
import { useTripLayout } from "../../trip/[tripId]/TripLayoutContext"
import { GlobeIcon, XIcon } from "lucide-react"
import { formatCurrencyAmount } from "../../utils/currency"
import { buildSegmentTitleTokens, buildSegmentConfigFromApi, getSegmentNickname, tokensToLabel } from "../../utils/formatters"

const GLOBE_HEIGHT = 380

interface LocationPopover {
  locationKey: string
  location: ItineraryLocation
}

interface ItineraryViewProps {
  segments: SegmentApi[]
  selectedSegmentIds: number[]
  segmentTypes: SegmentType[]
  currencies: Currency[]
  conversions: CurrencyConversion[]
  tripCurrencyId: number | null
  displayCurrencyId: number | null
  isLoading?: boolean
  onDisconnectSegment?: (segmentId: number) => void
}

export function ItineraryView({
  segments,
  selectedSegmentIds,
  segmentTypes,
  currencies,
  conversions,
  tripCurrencyId,
  displayCurrencyId,
  isLoading = false,
  onDisconnectSegment,
}: ItineraryViewProps) {
  const { openSegmentDetail } = useTripLayout()
  const containerRef = useRef<HTMLDivElement>(null)
  const [globeWidth, setGlobeWidth] = useState(0)
  const [activePopover, setActivePopover] = useState<LocationPopover | null>(null)
  const [activeArcPopover, setActiveArcPopover] = useState<ItineraryArc | null>(null)
  const [cardSegmentId, setCardSegmentId] = useState<number | null>(null)
  const [cardAnchorEl, setCardAnchorEl] = useState<HTMLDivElement | null>(null)
  const [globeReady, setGlobeReady] = useState(false)
  const globeFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextGlobeClickRef = useRef(false)
  // Prevents the document-level click handler from immediately closing a popover/card
  // that was just opened by an arc/location click in the same event.
  const skipDocumentClickRef = useRef(false)

  const data = useItineraryData({
    segments,
    selectedSegmentIds,
    segmentTypes,
    currencies,
    conversions,
    tripCurrencyId,
    displayCurrencyId,
  })

  // Measure container width — read immediately on mount, then watch for resize
  useEffect(() => {
    if (!containerRef.current) return
    const el = containerRef.current
    const init = Math.floor(el.getBoundingClientRect().width)
    if (init > 0) setGlobeWidth(init)
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setGlobeWidth(Math.floor(w))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const formatSegmentCost = useCallback(
    (seg: SegmentApi) => {
      if (seg.cost == null) return null
      return formatCurrencyAmount(seg.cost, seg.currencyId ?? data.displayCurrencyId, currencies)
    },
    [data.displayCurrencyId, currencies]
  )

  const openCard = useCallback((segmentId: number, anchorEl?: HTMLDivElement, keepPopover = false) => {
    skipNextGlobeClickRef.current = true
    skipDocumentClickRef.current = true
    setCardSegmentId((prev) => (prev === segmentId ? null : segmentId))
    if (anchorEl) setCardAnchorEl(anchorEl)
    if (!keepPopover) {
      setActivePopover(null)
      setActiveArcPopover(null)
    }
  }, [])

  const closeCard = useCallback(() => {
    setCardSegmentId(null)
    setCardAnchorEl(null)
  }, [])

  const handleGlobeReady = useCallback(() => {
    if (globeFallbackTimerRef.current) {
      clearTimeout(globeFallbackTimerRef.current)
      globeFallbackTimerRef.current = null
    }
    setGlobeReady(true)
  }, [])

  const showEmpty = !isLoading && (selectedSegmentIds.length === 0 || data.locations.length === 0)

  useEffect(() => {
    if (isLoading) {
      setGlobeReady(false)
      if (globeFallbackTimerRef.current) {
        clearTimeout(globeFallbackTimerRef.current)
        globeFallbackTimerRef.current = null
      }
    }
  }, [isLoading])

  useEffect(() => {
    if (globeWidth === 0 || isLoading || showEmpty) return
    if (globeFallbackTimerRef.current) return
    globeFallbackTimerRef.current = setTimeout(() => setGlobeReady(true), 5000)
  }, [globeWidth, isLoading, showEmpty])

  // Close all overlays when clicking anywhere outside them.
  // Uses a skip-ref so the same click that opens a popover/card doesn't immediately close it.
  useEffect(() => {
    const handler = () => {
      if (skipDocumentClickRef.current) {
        skipDocumentClickRef.current = false
        return
      }
      setCardSegmentId(null)
      setCardAnchorEl(null)
      setActivePopover(null)
      setActiveArcPopover(null)
    }
    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [])

  const handleGlobeClick = useCallback(() => {
    if (skipNextGlobeClickRef.current) {
      skipNextGlobeClickRef.current = false
      return
    }
    setCardSegmentId(null)
    setActivePopover(null)
    setActiveArcPopover(null)
  }, [])

  const handleLocationClick = useCallback(
    (locationKey: string) => {
      const location = data.locations.find((l) => l.key === locationKey)
      if (!location) return
      skipNextGlobeClickRef.current = true
      skipDocumentClickRef.current = true
      closeCard()
      setActiveArcPopover(null)
      setActivePopover((prev) => (prev?.locationKey === locationKey ? null : { locationKey, location }))
    },
    [data.locations, closeCard]
  )

  const handleArcClick = useCallback((arc: ItineraryArc) => {
    skipNextGlobeClickRef.current = true
    skipDocumentClickRef.current = true
    closeCard()
    setActivePopover(null)
    setActiveArcPopover((prev) => (prev === arc ? null : arc))
  }, [closeCard])

  const cardSegment = cardSegmentId != null ? segments.find((s) => s.id === cardSegmentId) ?? null : null
  const cardSegmentType = cardSegment ? (segmentTypes.find((t) => t.id === cardSegment.segmentTypeId) ?? null) : null

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Cost breakdown — only when there's data */}
      {!isLoading && !showEmpty && (
        <ItineraryCostBreakdown
          costBreakdown={data.costBreakdown}
          totalCost={data.totalCost}
          totalDays={data.totalDays}
          costPerDay={data.costPerDay}
          dateRange={data.dateRange}
          displayCurrencyId={data.displayCurrencyId}
          currencies={currencies}
          onSegmentClick={openSegmentDetail}
          onDisconnectSegment={onDisconnectSegment}
        />
      )}

      {/* Globe container — always mounted so ResizeObserver fires on first render */}
      <div
        ref={containerRef}
        className="relative shrink-0 w-full"
        style={{ height: GLOBE_HEIGHT }}
        onClick={() => { closeCard(); setActivePopover(null); setActiveArcPopover(null) }}
      >
        {/* Loading overlay */}
        {(isLoading || (!globeReady && !showEmpty)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground z-10">
            <GlobeIcon className="h-10 w-10 animate-spin" strokeWidth={1.2} style={{ animationDuration: "3s" }} />
            {isLoading && <p className="text-sm">Loading itinerary…</p>}
          </div>
        )}

        {/* Empty state overlay */}
        {showEmpty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6 text-muted-foreground">
            <GlobeIcon className="h-10 w-10 mb-3 opacity-30" strokeWidth={1.2} />
            <p className="text-sm">No location data to display.</p>
            <p className="text-xs mt-1">Switch to Itinerary edit and connect segments with locations.</p>
          </div>
        )}
        {globeWidth > 0 && !isLoading && !showEmpty && (
          <ItineraryGlobe
            locations={data.locations}
            arcs={data.arcs}
            width={globeWidth}
            height={GLOBE_HEIGHT}
            onLocationClick={handleLocationClick}
            onArcClick={handleArcClick}
            onGlobeClick={handleGlobeClick}
            onReady={handleGlobeReady}
          />
        )}

        {/* Segment info card */}
        <TimelineSegmentCard
          segment={cardSegment}
          segmentType={cardSegmentType}
          anchorEl={cardAnchorEl}
          formatSegmentCost={formatSegmentCost}
          onClose={closeCard}
          onNavigateToSegment={(id) => { openSegmentDetail(id); closeCard() }}
        />

        {/* Location popover — segments at a pin */}
        {activePopover && (
          <div className="absolute bottom-4 left-4 right-4 z-10 rounded-lg border border-border bg-background/95 backdrop-blur-sm shadow-lg p-3 text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <div className="font-semibold">{activePopover.location.name}</div>
                {activePopover.location.country && (
                  <div className="text-xs text-muted-foreground">{activePopover.location.country}</div>
                )}
              </div>
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); setActivePopover(null) }}
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {activePopover.location.segments.map(({ segment: seg, segmentType: st }) => (
                <button
                  key={seg.id}
                  type="button"
                  className="w-full flex items-center gap-2 text-left rounded px-2 py-1 hover:bg-muted/60 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    openCard(seg.id, e.currentTarget as unknown as HTMLDivElement, true)
                  }}
                >
                  {st?.iconSvg ? (
                    <div
                      className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center overflow-hidden [&_svg]:w-4 [&_svg]:h-4"
                      style={{ background: st.color ?? "#6b7280" }}
                      dangerouslySetInnerHTML={{ __html: st.iconSvg }}
                    />
                  ) : (
                    <div className="h-7 w-7 shrink-0 rounded-full bg-muted flex items-center justify-center text-[10px]">
                      {st?.shortName?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <span
                    className="text-xs truncate"
                    title={getSegmentNickname(seg.name) ?? undefined}
                  >
                    {tokensToLabel(buildSegmentTitleTokens(buildSegmentConfigFromApi(seg, st ?? undefined))) || st?.name || "Segment"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Arc popover — all segments on a clicked route */}
        {activeArcPopover && (
          <div className="absolute bottom-4 left-4 right-4 z-10 rounded-lg border border-border bg-background/95 backdrop-blur-sm shadow-lg p-3 text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="font-semibold truncate">
                {activeArcPopover.startName} → {activeArcPopover.endName}
              </div>
              <button
                type="button"
                className="shrink-0 text-muted-foreground hover:text-foreground"
                onClick={(e) => { e.stopPropagation(); setActiveArcPopover(null) }}
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1">
              {activeArcPopover.routeSegments.map(({ segment: seg, segmentType: st }) => (
                <button
                  key={seg.id}
                  type="button"
                  className="w-full flex items-center gap-2 text-left rounded px-2 py-1 hover:bg-muted/60 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation()
                    openCard(seg.id, e.currentTarget as unknown as HTMLDivElement, true)
                  }}
                >
                  {st?.iconSvg ? (
                    <div
                      className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center overflow-hidden [&_svg]:w-4 [&_svg]:h-4"
                      style={{ background: st.color ?? "#6b7280" }}
                      dangerouslySetInnerHTML={{ __html: st.iconSvg }}
                    />
                  ) : (
                    <div className="h-7 w-7 shrink-0 rounded-full bg-muted flex items-center justify-center text-[10px]">
                      {st?.shortName?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                  )}
                  <span
                    className="text-xs truncate"
                    title={getSegmentNickname(seg.name) ?? undefined}
                  >
                    {tokensToLabel(buildSegmentTitleTokens(buildSegmentConfigFromApi(seg, st ?? undefined))) || st?.name || "Segment"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
