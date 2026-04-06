"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import dynamic from "next/dynamic"
import { PlusIcon, MinusIcon } from "lucide-react"
import type { ItineraryLocation, ItineraryArc } from "../../hooks/useItineraryData"
import type { SegmentType } from "../../types/models"
import { useThemePreference } from "../../providers/ThemeProvider"

// Dynamic import to avoid SSR issues with three.js/WebGL
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false })

// Locally hosted earth textures (copied from three-globe package to /public)
const EARTH_LIGHT_URL = "/earth-blue-marble.jpg"
const EARTH_DARK_URL  = "/earth-night.jpg"

// Zoom constants — 10 clicks covers full 0–100% range on a log scale
const MIN_ALT  = 0.0016          // ≈10 km above surface
const MAX_ALT  = 8
const LOG_RANGE = Math.log(MAX_ALT / MIN_ALT)   // ≈8.52
const ZOOM_FACTOR = Math.exp(LOG_RANGE / 10)    // per-click factor ≈2.34

// Badge background/icon colours matching the timeline bar pattern
const BADGE_BG_LIGHT  = "#ffffff"
const BADGE_BG_DARK   = "#27272a"
const ICON_FILL_LIGHT = "#3f3f46"
const ICON_FILL_DARK  = "#e4e4e7"

// --- Geo helpers ---

function toRad(d: number) { return d * Math.PI / 180 }

/** Great-circle angular distance between two points, in radians. */
function angularDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = toRad(lat1), φ2 = toRad(lat2)
  const Δφ = toRad(lat2 - lat1), Δλ = toRad(lng2 - lng1)
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return 2 * Math.asin(Math.sqrt(a))
}

/** Geographic centroid via 3-D unit vectors (handles date-line wrap correctly). */
function geoCentroid(locations: ItineraryLocation[]): { lat: number; lng: number } {
  let x = 0, y = 0, z = 0
  for (const { lat, lng } of locations) {
    const φ = toRad(lat), λ = toRad(lng)
    x += Math.cos(φ) * Math.cos(λ)
    y += Math.cos(φ) * Math.sin(λ)
    z += Math.sin(φ)
  }
  const n = locations.length
  return {
    lat: (Math.atan2(z / n, Math.sqrt((x / n) ** 2 + (y / n) ** 2))) * 180 / Math.PI,
    lng: Math.atan2(y / n, x / n) * 180 / Math.PI,
  }
}

/** Returns pointOfView that fits all locations with padding. */
function fitLocations(locations: ItineraryLocation[]): { lat: number; lng: number; altitude: number } {
  if (locations.length === 0) return { lat: 20, lng: 10, altitude: 2.5 }
  if (locations.length === 1) return { lat: locations[0].lat, lng: locations[0].lng, altitude: 1.4 }

  const center = geoCentroid(locations)
  let maxRad = 0
  for (const loc of locations) {
    maxRad = Math.max(maxRad, angularDist(center.lat, center.lng, loc.lat, loc.lng))
  }

  if (maxRad > toRad(90)) return { lat: locations[0].lat, lng: locations[0].lng, altitude: 2.5 }

  const altitude = Math.min((1 / Math.cos(maxRad) - 1) * 1.25 + 0.15, 2.5)
  return { lat: center.lat, lng: center.lng, altitude: Math.max(altitude, 0.3) }
}

// ---------------------

interface ItineraryGlobeProps {
  locations: ItineraryLocation[]
  arcs: ItineraryArc[]
  segmentTypes: SegmentType[]
  width: number
  height: number
  onLocationClick: (locationKey: string) => void
  onArcClick: (segmentId: number, anchorEl: HTMLDivElement) => void
  onGlobeClick: () => void
  onReady?: () => void
}

interface ArcMidpoint {
  lat: number
  lng: number
  arc: ItineraryArc
}

export function ItineraryGlobe({
  locations,
  arcs,
  segmentTypes,
  width,
  height,
  onLocationClick,
  onArcClick,
  onGlobeClick,
  onReady,
}: ItineraryGlobeProps) {
  const globeRef = useRef<any>(null)
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady
  const { resolvedTheme } = useThemePreference()
  const isDark = resolvedTheme === "dark"

  // Tracks current altitude for dynamic arc stroke + zoom % display
  const [currentAlt, setCurrentAlt] = useState(2.5)
  const arcStroke = Math.min(Math.max(currentAlt * 0.1, 0.002), 1.0)
  const zoomPct = Math.round(Math.max(0, Math.min(100, 100 * Math.log(MAX_ALT / currentAlt) / LOG_RANGE)))

  const arcMidpoints: ArcMidpoint[] = arcs.map((arc) => ({
    lat: arc.midLat,
    lng: arc.midLng,
    arc,
  }))

  type HtmlItem =
    | { kind: "location"; data: ItineraryLocation }
    | { kind: "midpoint"; data: ArcMidpoint }

  const htmlItems: HtmlItem[] = [
    ...locations.map((l) => ({ kind: "location" as const, data: l })),
    ...arcMidpoints.map((m) => ({ kind: "midpoint" as const, data: m })),
  ]

  const buildHtmlElement = useCallback(
    (item: object): HTMLElement => {
      const typedItem = item as HtmlItem
      const el = document.createElement("div")
      const badgeBg  = isDark ? BADGE_BG_DARK  : BADGE_BG_LIGHT
      const iconFill = isDark ? ICON_FILL_DARK  : ICON_FILL_LIGHT

      if (typedItem.kind === "location") {
        const loc = typedItem.data as ItineraryLocation
        const seenTypeIds = new Set<number>()
        const uniqueTypes = loc.segments
          .map((s) => s.segmentType)
          .filter((st) => {
            if (seenTypeIds.has(st.id)) return false
            seenTypeIds.add(st.id)
            return true
          })

        el.style.cssText = [
          "display:flex",
          "flex-direction:column",
          "align-items:center",
          "gap:4px",
          "cursor:pointer",
          "pointer-events:all",
        ].join(";")

        // Teardrop map-pin shape (SVG)
        const pinWrap = document.createElement("div")
        pinWrap.innerHTML = `<svg width="22" height="30" viewBox="0 0 22 30" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 0C4.925 0 0 4.925 0 11c0 8.25 11 19 11 19s11-10.75 11-19c0-6.075-4.925-11-11-11z"
            fill="#ffffff" stroke="rgba(0,0,0,0.35)" stroke-width="1.5"/>
          <circle cx="11" cy="11" r="4.5" fill="rgba(0,0,0,0.25)"/>
        </svg>`
        pinWrap.style.cssText = "line-height:0;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))"

        // Segment-type badge row
        const row = document.createElement("div")
        row.style.cssText = "display:flex;gap:3px"

        for (const st of uniqueTypes.slice(0, 4)) {
          const typeColor = st.color?.trim() || "#6b7280"
          const badge = document.createElement("div")
          badge.style.cssText = [
            "width:26px;height:26px",
            "border-radius:50%",
            `background:${badgeBg}`,
            `border:2px solid ${typeColor}`,
            "display:flex;align-items:center;justify-content:center",
            "overflow:hidden",
            "box-shadow:0 1px 5px rgba(0,0,0,0.35)",
          ].join(";")
          if (st.iconSvg) {
            const wrap = document.createElement("span")
            wrap.style.cssText = `display:flex;width:14px;height:14px;color:${iconFill}`
            wrap.innerHTML = st.iconSvg
            const svg = wrap.querySelector("svg")
            if (svg) {
              svg.style.width = "14px"
              svg.style.height = "14px"
              svg.style.fill = iconFill
            }
            badge.appendChild(wrap)
          } else {
            badge.textContent = st.shortName?.charAt(0)?.toUpperCase() ?? "?"
            badge.style.fontSize = "10px"
            badge.style.color = iconFill
          }
          row.appendChild(badge)
        }

        el.appendChild(pinWrap)
        el.appendChild(row)
        el.addEventListener("click", (e) => {
          e.stopPropagation()
          onLocationClick(loc.key)
        })
      } else {
        // Arc midpoint — coloured circle with segment type icon
        const mp = typedItem.data as ArcMidpoint
        const st = mp.arc.segmentType
        el.style.cssText = [
          "width:30px;height:30px",
          "border-radius:50%",
          `background:${mp.arc.color}`,
          "border:2px solid rgba(255,255,255,0.6)",
          "display:flex;align-items:center;justify-content:center",
          "cursor:pointer;pointer-events:all",
          "box-shadow:0 2px 8px rgba(0,0,0,0.5)",
        ].join(";")
        if (st.iconSvg) {
          const wrap = document.createElement("span")
          wrap.style.cssText = "display:flex;width:18px;height:18px;color:#ffffff"
          wrap.innerHTML = st.iconSvg
          const svg = wrap.querySelector("svg")
          if (svg) {
            svg.style.width = "18px"
            svg.style.height = "18px"
            svg.style.fill = "#ffffff"
          }
          el.appendChild(wrap)
        } else {
          el.textContent = st.shortName?.charAt(0)?.toUpperCase() ?? "?"
          el.style.fontSize = "11px"
          el.style.color = "#fff"
        }
        el.addEventListener("click", (e) => {
          e.stopPropagation()
          onArcClick(mp.arc.segment.id, el as HTMLDivElement)
        })
      }

      return el
    },
    [onLocationClick, onArcClick, isDark]
  )

  // Re-center when locations change (subsequent updates after initial mount)
  useEffect(() => {
    if (!globeRef.current || locations.length === 0) return
    const { lat, lng, altitude } = fitLocations(locations)
    globeRef.current.pointOfView({ lat, lng, altitude }, 800)
  }, [locations])

  const handleGlobeReady = useCallback(() => {
    if (!globeRef.current) return
    const controls = globeRef.current.controls()
    if (controls) {
      controls.autoRotate = false
      // Track altitude changes so arc stroke and zoom % update dynamically
      controls.addEventListener("change", () => {
        const pov = globeRef.current?.pointOfView()
        if (pov?.altitude !== undefined) setCurrentAlt(pov.altitude)
      })
    }
    // Center immediately once the globe is fully initialized (dynamic import delay)
    if (locations.length > 0) {
      const { lat, lng, altitude } = fitLocations(locations)
      globeRef.current.pointOfView({ lat, lng, altitude }, 0)
    }
    onReadyRef.current?.()
  }, [locations])

  const handleZoom = useCallback((direction: "in" | "out") => {
    if (!globeRef.current) return
    const current = globeRef.current.pointOfView()
    // Each click = 10% of log zoom range (10 clicks covers full 0–100%)
    const next = direction === "in"
      ? Math.max(current.altitude / ZOOM_FACTOR, MIN_ALT)
      : Math.min(current.altitude * ZOOM_FACTOR, MAX_ALT)
    globeRef.current.pointOfView({ altitude: next }, 300)
  }, [])

  return (
    <div className="relative overflow-hidden rounded-lg bg-transparent select-none" style={{ width, height }}>
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={isDark ? EARTH_DARK_URL : EARTH_LIGHT_URL}
        showAtmosphere={false}
        // Arcs — dashed animated lines for transport routes
        arcsData={arcs}
        arcStartLat={(d) => (d as ItineraryArc).startLat}
        arcStartLng={(d) => (d as ItineraryArc).startLng}
        arcEndLat={(d) => (d as ItineraryArc).endLat}
        arcEndLng={(d) => (d as ItineraryArc).endLng}
        arcColor={(d: object) => (d as ItineraryArc).color}
        arcAltitudeAutoScale={0.4}
        arcStroke={arcStroke}
        arcDashLength={0.4}
        arcDashGap={0.2}
        arcDashAnimateTime={5000}
        // HTML elements — location markers + arc midpoint icons
        htmlElementsData={htmlItems}
        htmlLat={(d) => {
          const item = d as HtmlItem
          return item.kind === "location"
            ? (item.data as ItineraryLocation).lat
            : (item.data as ArcMidpoint).lat
        }}
        htmlLng={(d) => {
          const item = d as HtmlItem
          return item.kind === "location"
            ? (item.data as ItineraryLocation).lng
            : (item.data as ArcMidpoint).lng
        }}
        htmlAltitude={(d) => {
          const item = d as HtmlItem
          return item.kind === "midpoint" ? 0.1 : 0
        }}
        htmlElement={buildHtmlElement}
        onGlobeReady={handleGlobeReady}
        onGlobeClick={onGlobeClick}
        enablePointerInteraction
      />

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col items-center gap-1 z-10">
        <button
          type="button"
          onClick={() => handleZoom("in")}
          className="h-8 w-8 rounded-md border border-border bg-background/80 backdrop-blur-sm shadow flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Zoom in"
        >
          <PlusIcon className="h-4 w-4" />
        </button>
        <span className="text-[10px] font-mono leading-none px-1 py-0.5 rounded bg-background/80 backdrop-blur-sm border border-border text-foreground/70 select-none">
          {zoomPct}%
        </span>
        <button
          type="button"
          onClick={() => handleZoom("out")}
          className="h-8 w-8 rounded-md border border-border bg-background/80 backdrop-blur-sm shadow flex items-center justify-center hover:bg-muted transition-colors"
          aria-label="Zoom out"
        >
          <MinusIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
