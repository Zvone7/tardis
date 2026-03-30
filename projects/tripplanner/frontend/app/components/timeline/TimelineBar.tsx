"use client"

import { useRef } from "react"
import { cn } from "../../lib/utils"
import type { SegmentApi, SegmentType } from "../../types/models"
import type { PanelMode } from "../../trip/[tripId]/TripLayoutContext"
import { segmentColor } from "../../utils/segmentVisuals"

const LANE_HEIGHT_DESKTOP = 36
const LANE_HEIGHT_TOUCH = 28
const LANE_GAP = 3

export const LANE_HEIGHT = { desktop: LANE_HEIGHT_DESKTOP, touch: LANE_HEIGHT_TOUCH }
export const LANE_GAP_PX = LANE_GAP

interface TimelineBarProps {
  segment: SegmentApi
  segmentType: SegmentType | null
  lane: number
  viewportStart: number
  viewportRange: number
  /** Minimum bar width as % of the full canvas, ensures icon is always legible */
  minWidthPct?: number
  selected: boolean
  hovered: boolean
  dimmed: boolean
  onMouseEnter: (id: number, el: HTMLDivElement) => void
  onMouseLeave: () => void
  onClick: (id: number, el: HTMLDivElement) => void
  panelMode: PanelMode
}

export function TimelineBar({
  segment,
  segmentType,
  lane,
  viewportStart,
  viewportRange,
  minWidthPct = 1.5,
  selected,
  hovered,
  dimmed,
  onMouseEnter,
  onMouseLeave,
  onClick,
  panelMode,
}: TimelineBarProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isTouch = panelMode !== "desktop"
  const laneH = isTouch ? LANE_HEIGHT_TOUCH : LANE_HEIGHT_DESKTOP

  const startMs = new Date(segment.startDateTimeUtc).getTime()
  const endMs = new Date(segment.endDateTimeUtc).getTime()

  const leftPct = viewportRange > 0 ? ((startMs - viewportStart) / viewportRange) * 100 : 0
  const rightPct = viewportRange > 0 ? ((endMs - viewportStart) / viewportRange) * 100 : 0
  const widthPct = Math.max(minWidthPct, rightPct - leftPct)

  const top = lane * (laneH + LANE_GAP)
  // Only use dot if bar is below the minimum icon-safe width (shouldn't happen with minWidthPct set)
  const isTooNarrowForIcon = widthPct < minWidthPct * 0.8
  const typeColor = segmentColor(segmentType)

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-label={segment.name}
      aria-pressed={selected}
      className={cn(
        "absolute rounded cursor-pointer transition-all duration-150 overflow-hidden",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        selected
          ? "bg-primary opacity-100 ring-1 ring-primary/40"
          : "bg-muted-foreground/25 border border-dashed border-muted-foreground/30 opacity-70",
        hovered && "ring-2 ring-foreground/40 z-10 opacity-100",
        dimmed && "!opacity-30",
      )}
      style={{
        left: `${leftPct}%`,
        width: `${widthPct}%`,
        top,
        height: laneH,
      }}
      onClick={() => ref.current && onClick(segment.id, ref.current)}
      onMouseEnter={() => !isTouch && ref.current && onMouseEnter(segment.id, ref.current)}
      onMouseLeave={() => !isTouch && onMouseLeave()}
      onKeyDown={(e) =>
        e.key === "Enter" || e.key === " " ? ref.current && onClick(segment.id, ref.current) : undefined
      }
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {isTooNarrowForIcon ? (
          <div
            className={cn("w-2 h-2 rounded-full", selected ? "bg-primary-foreground/80" : "bg-muted-foreground/50")}
          />
        ) : segmentType?.iconSvg ? (
          <div
            className="w-5 h-5 rounded-full bg-white dark:bg-zinc-800 flex items-center justify-center shrink-0"
            style={{ minWidth: 20, border: `2px solid ${typeColor}` }}
          >
            <span
              className="w-3 h-3 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-zinc-700 dark:[&>svg]:fill-zinc-100"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: segmentType.iconSvg }}
              suppressHydrationWarning
            />
          </div>
        ) : (
          <div
            className={cn("w-3 h-3 rounded-full", selected ? "bg-primary-foreground/80" : "bg-muted-foreground/50")}
          />
        )}
      </div>
    </div>
  )
}
