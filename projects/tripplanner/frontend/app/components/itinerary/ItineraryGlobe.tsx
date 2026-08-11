"use client"

import { useRef, useEffect, useCallback, useState } from "react"
import dynamic from "next/dynamic"
import { PlusIcon, MinusIcon } from "lucide-react"
import type { ItineraryLocation, ItineraryArc } from "../../hooks/useItineraryData"
import { useThemePreference } from "../../providers/ThemeProvider"
import {
  detectEarthTextureResolution,
  EARTH_TEXTURES,
  type EarthTextureResolution,
} from "./earthTexture"

// Dynamic import to avoid SSR issues with three.js/WebGL
const Globe = dynamic(() => import("react-globe.gl"), { ssr: false })

// Zoom constants — 10 clicks covers full 0–100% range on a log scale
const MAX_ALT  = 8

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

/** Returns pointOfView that fits all locations, centered on the first (start) location. */
function fitLocations(locations: ItineraryLocation[]): { lat: number; lng: number; altitude: number } {
  if (locations.length === 0) return { lat: 20, lng: 10, altitude: 2.5 }

  const start = locations[0]
  if (locations.length === 1) return { lat: start.lat, lng: start.lng, altitude: 1.4 }

  const center = geoCentroid(locations)
  let maxRad = 0
  for (const loc of locations) {
    maxRad = Math.max(maxRad, angularDist(center.lat, center.lng, loc.lat, loc.lng))
  }

  if (maxRad > toRad(90)) return { lat: start.lat, lng: start.lng, altitude: 2.5 }

  const altitude = Math.min((1 / Math.cos(maxRad) - 1) * 1.25 + 0.15, 2.5)
  return { lat: start.lat, lng: start.lng, altitude: Math.max(altitude, 0.3) }
}

// ---------------------

interface ItineraryGlobeProps {
  locations: ItineraryLocation[]
  arcs: ItineraryArc[]
  width: number
  height: number
  onLocationClick: (locationKey: string) => void
  onArcClick: (arc: ItineraryArc) => void
  onGlobeClick: () => void
  onReady?: () => void
}

export function ItineraryGlobe({
  locations,
  arcs,
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
  const onArcClickRef = useRef(onArcClick)
  onArcClickRef.current = onArcClick
  const { resolvedTheme } = useThemePreference()
  const isDark = resolvedTheme === "dark"
  const [textureResolution, setTextureResolution] = useState<EarthTextureResolution>("4k")
  const texture = EARTH_TEXTURES[textureResolution]
  const logRange = Math.log(MAX_ALT / texture.minAltitude)
  const zoomFactor = Math.exp(logRange / 10)

  useEffect(() => {
    setTextureResolution(detectEarthTextureResolution())
  }, [])

  // Tracks current altitude for dynamic arc stroke + zoom % display
  const [currentAlt, setCurrentAlt] = useState(2.5)
  const arcStroke = Math.min(Math.max(currentAlt * 0.8, 0.06), 3.5)

  // Each arc is duplicated: visible arc + invisible wide hit-area arc for easier clicking
  type LayeredArc = ItineraryArc & { _hitArea?: true }
  const layeredArcs: LayeredArc[] = [
    ...arcs,
    ...arcs.map((a) => ({ ...a, _hitArea: true as const })),
  ]
  const zoomPct = Math.round(Math.max(0, Math.min(100, 100 * Math.log(MAX_ALT / currentAlt) / logRange)))

  const configureZoomLimits = useCallback(() => {
    if (!globeRef.current) return
    const controls = globeRef.current.controls()
    if (!controls) return

    const globeRadius = globeRef.current.getGlobeRadius()
    controls.minDistance = globeRadius * (1 + texture.minAltitude)
    controls.maxDistance = globeRadius * (1 + MAX_ALT)
    controls.update()
  }, [texture.minAltitude])

  useEffect(() => {
    configureZoomLimits()
  }, [configureZoomLimits])

  const buildHtmlElement = useCallback(
    (item: object): HTMLElement => {
      const loc = item as ItineraryLocation
      const el = document.createElement("div")

      el.style.cssText = [
        "display:flex",
        "flex-direction:column",
        "align-items:center",
        "gap:3px",
        "cursor:pointer",
        "pointer-events:all",
      ].join(";")

      // Location name label above the pin
      const label = document.createElement("div")
      label.textContent = loc.name
      label.style.cssText = [
        "font-size:10px",
        "font-weight:600",
        "white-space:nowrap",
        "padding:1px 5px",
        "border-radius:3px",
        "background:rgba(0,0,0,0.55)",
        "color:#ffffff",
        "letter-spacing:0.01em",
      ].join(";")

      // Teardrop map-pin shape (SVG)
      const pinWrap = document.createElement("div")
      pinWrap.innerHTML = `<svg width="22" height="30" viewBox="0 0 22 30" xmlns="http://www.w3.org/2000/svg">
        <path d="M11 0C4.925 0 0 4.925 0 11c0 8.25 11 19 11 19s11-10.75 11-19c0-6.075-4.925-11-11-11z"
          fill="#ffffff" stroke="rgba(0,0,0,0.35)" stroke-width="1.5"/>
        <circle cx="11" cy="11" r="4.5" fill="rgba(0,0,0,0.25)"/>
      </svg>`
      pinWrap.style.cssText = "line-height:0;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))"

      el.appendChild(label)
      el.appendChild(pinWrap)
      el.addEventListener("click", (e) => {
        e.stopPropagation()
        onLocationClick(loc.key)
      })

      return el
    },
    [onLocationClick]
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
      configureZoomLimits()
      controls.addEventListener("change", () => {
        const pov = globeRef.current?.pointOfView()
        if (pov?.altitude !== undefined) setCurrentAlt(pov.altitude)
      })
    }
    if (locations.length > 0) {
      const { lat, lng, altitude } = fitLocations(locations)
      globeRef.current.pointOfView({ lat, lng, altitude }, 0)
    }
    onReadyRef.current?.()
  }, [configureZoomLimits, locations])

  const handleZoom = useCallback((direction: "in" | "out") => {
    if (!globeRef.current) return
    const current = globeRef.current.pointOfView()
    const next = direction === "in"
      ? Math.max(current.altitude / zoomFactor, texture.minAltitude)
      : Math.min(current.altitude * zoomFactor, MAX_ALT)
    globeRef.current.pointOfView({ altitude: next }, 300)
  }, [texture.minAltitude, zoomFactor])

  return (
    <div className="relative overflow-hidden rounded-lg bg-transparent select-none" style={{ width, height }}>
      <Globe
        ref={globeRef}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={isDark ? texture.dark : texture.light}
        showAtmosphere={false}
        // Arcs — each real arc duplicated with an invisible wide hit-area twin for easier clicking
        arcsData={layeredArcs}
        arcStartLat={(d) => (d as LayeredArc).startLat}
        arcStartLng={(d) => (d as LayeredArc).startLng}
        arcEndLat={(d) => (d as LayeredArc).endLat}
        arcEndLng={(d) => (d as LayeredArc).endLng}
        arcColor={(d: object) => {
          const a = d as LayeredArc
          return a._hitArea ? "rgba(0,0,0,0.01)" : a.color
        }}
        arcAltitudeAutoScale={0.4}
        arcStroke={(d: object) => {
          const a = d as LayeredArc
          return a._hitArea ? arcStroke * 5 : arcStroke
        }}
        arcDashLength={(d: object) => (d as LayeredArc)._hitArea ? 1 : 0.3}
        arcDashGap={(d: object) => (d as LayeredArc)._hitArea ? 0 : 0.08}
        arcDashAnimateTime={(d: object) => (d as LayeredArc)._hitArea ? 0 : 12000}
        onArcClick={(arc: object) => {
          const a = arc as LayeredArc
          const base: ItineraryArc = { ...a }
          delete (base as LayeredArc)._hitArea
          onArcClickRef.current(base)
        }}
        // HTML elements — location pins only
        htmlElementsData={locations}
        htmlLat={(d) => (d as ItineraryLocation).lat}
        htmlLng={(d) => (d as ItineraryLocation).lng}
        htmlAltitude={0}
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
