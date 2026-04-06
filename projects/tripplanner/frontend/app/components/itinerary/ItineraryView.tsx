"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import type { SegmentApi, SegmentType, Currency, CurrencyConversion } from "../../types/models"
import { useItineraryData, type ItineraryLocation } from "../../hooks/useItineraryData"
import { ItineraryGlobe } from "./ItineraryGlobe"
import { ItineraryCostBreakdown } from "./ItineraryCostBreakdown"
import { useTripLayout } from "../../trip/[tripId]/TripLayoutContext"
import { GlobeIcon, XIcon, PencilIcon } from "lucide-react"
import { formatCurrencyAmount } from "../../utils/currency"

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
}: ItineraryViewProps) {
  const { openSegmentDetail } = useTripLayout()
  const containerRef = useRef<HTMLDivElement>(null)
  const [globeWidth, setGlobeWidth] = useState(0)
  const [activePopover, setActivePopover] = useState<LocationPopover | null>(null)
  const [cardSegmentId, setCardSegmentId] = useState<number | null>(null)
  const [globeReady, setGlobeReady] = useState(false)
  // Prevents onGlobeClick from immediately closing a card that was just opened
  // by an icon click (globe fires its click even when HTML elements are clicked)
  const skipNextGlobeClickRef = useRef(false)

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

  const openCard = useCallback((segmentId: number) => {
    // Signal the globe click handler to skip this cycle — the globe fires its
    // onGlobeClick even when an HTML element (arc icon) was clicked
    skipNextGlobeClickRef.current = true
    setCardSegmentId((prev) => (prev === segmentId ? null : segmentId))
    setActivePopover(null)
  }, [])

  const closeCard = useCallback(() => setCardSegmentId(null), [])

  const handleGlobeClick = useCallback(() => {
    if (skipNextGlobeClickRef.current) {
      skipNextGlobeClickRef.current = false
      return
    }
    setCardSegmentId(null)
    setActivePopover(null)
  }, [])

  const handleLocationClick = useCallback(
    (locationKey: string) => {
      const location = data.locations.find((l) => l.key === locationKey)
      if (!location) return
      closeCard()
      setActivePopover((prev) => (prev?.locationKey === locationKey ? null : { locationKey, location }))
    },
    [data.locations, closeCard]
  )

  const handleArcClick = useCallback(
    (segmentId: number, _anchorEl: HTMLDivElement) => {
      setActivePopover(null)
      openCard(segmentId)
    },
    [openCard]
  )

  const cardSegment = cardSegmentId != null ? segments.find((s) => s.id === cardSegmentId) ?? null : null

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <GlobeIcon className="h-10 w-10 animate-spin" strokeWidth={1.2} style={{ animationDuration: "3s" }} />
        <p className="text-sm">Loading itinerary…</p>
      </div>
    )
  }

  if (selectedSegmentIds.length === 0 || data.locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12 text-muted-foreground">
        <GlobeIcon className="h-10 w-10 mb-3 opacity-30" strokeWidth={1.2} />
        <p className="text-sm">No location data to display.</p>
        <p className="text-xs mt-1">Switch to Itinerary edit and connect segments with locations.</p>
      </div>
    )
  }

  const cardCostLabel = cardSegment ? formatSegmentCost(cardSegment) : null

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Cost breakdown — shown above the globe */}
      <ItineraryCostBreakdown
        costBreakdown={data.costBreakdown}
        totalCost={data.totalCost}
        totalDays={data.totalDays}
        costPerDay={data.costPerDay}
        dateRange={data.dateRange}
        displayCurrencyId={data.displayCurrencyId}
        currencies={currencies}
      />

      {/* Globe */}
      <div
        ref={containerRef}
        className="relative shrink-0 w-full"
        style={{ height: GLOBE_HEIGHT }}
        onClick={closeCard}
      >
        {!globeReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30 rounded-lg z-10">
            <GlobeIcon className="h-8 w-8 animate-spin text-muted-foreground" strokeWidth={1.2} style={{ animationDuration: "3s" }} />
          </div>
        )}
        {globeWidth > 0 && (
          <ItineraryGlobe
            locations={data.locations}
            arcs={data.arcs}
            segmentTypes={segmentTypes}
            width={globeWidth}
            height={GLOBE_HEIGHT}
            onLocationClick={handleLocationClick}
            onArcClick={handleArcClick}
            onGlobeClick={handleGlobeClick}
            onReady={() => setGlobeReady(true)}
          />
        )}

        {/* Segment info card — absolute overlay at top-left of globe */}
        {cardSegment && (
          <div
            className="absolute top-3 left-3 z-20 w-56 rounded-lg border border-border bg-background/95 backdrop-blur-sm shadow-lg p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-2 right-2 p-0.5 rounded hover:bg-muted transition-colors"
              onClick={closeCard}
              aria-label="Close"
            >
              <XIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <div className="text-sm font-medium pr-5 mb-1 leading-snug">{cardSegment.name}</div>
            {cardCostLabel && (
              <div className="text-xs text-muted-foreground mb-3">{cardCostLabel}</div>
            )}
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => { openSegmentDetail(cardSegment.id); closeCard() }}
            >
              <PencilIcon className="h-3.5 w-3.5" />
              Edit segment
            </button>
          </div>
        )}

        {/* Location popover — bottom overlay listing all segments at a pin */}
        {activePopover && (
          <div className="absolute bottom-4 left-4 right-4 z-10 rounded-lg border border-border bg-background/95 backdrop-blur-sm shadow-lg p-3 text-sm">
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
                    openCard(seg.id)
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
                  <span className="text-xs truncate">{seg.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
