"use client"

import type { Stage } from "../../types/stages"
import type { SegmentApi } from "../../types/models"
import type { TimelineLayout } from "./useTimelineLanes"
import { toPercent } from "./useTimelineLanes"

interface TimelineStageMarkersProps {
  stages: Stage[]
  segmentMap: Map<number, SegmentApi>
  layout: TimelineLayout
  laneCount: number
  laneHeight: number
  laneGap: number
  /** "labels" renders the stage name badges row above the bars; "backgrounds" renders tinted regions + dividers inside the bars area */
  variant: "labels" | "backgrounds"
}

const STAGE_BG_COLORS = [
  "rgba(99,102,241,0.06)",   // indigo tint
  "rgba(20,184,166,0.06)",   // teal tint
  "rgba(249,115,22,0.06)",   // orange tint
  "rgba(168,85,247,0.06)",   // purple tint
]

interface StageBounds {
  startMs: number
  endMs: number
  label: string
  color: string
}

function computeStageBounds(stages: Stage[], segmentMap: Map<number, SegmentApi>): StageBounds[] {
  return stages
    .map((stage, i) => {
      if (stage.selectedSegmentIds.length === 0) return null
      let minMs = Infinity
      let maxMs = -Infinity
      for (const id of stage.selectedSegmentIds) {
        const seg = segmentMap.get(id)
        if (!seg) continue
        if (seg.startDateTimeUtc) {
          const t = new Date(seg.startDateTimeUtc).getTime()
          if (t < minMs) minMs = t
        }
        if (seg.endDateTimeUtc) {
          const t = new Date(seg.endDateTimeUtc).getTime()
          if (t > maxMs) maxMs = t
        }
      }
      if (minMs === Infinity || maxMs === -Infinity) return null
      return {
        startMs: minMs,
        endMs: maxMs,
        label: `Stage ${stage.index + 1}: ${stage.location.name}`,
        color: STAGE_BG_COLORS[i % STAGE_BG_COLORS.length],
      }
    })
    .filter((b): b is StageBounds => b !== null)
}

export function TimelineStageMarkers({
  stages,
  segmentMap,
  layout,
  laneCount,
  laneHeight,
  laneGap,
  variant,
}: TimelineStageMarkersProps) {
  if (stages.length === 0 || layout.range === 0) return null

  const bounds = computeStageBounds(stages, segmentMap)
  if (bounds.length === 0) return null

  const totalHeight = laneCount * (laneHeight + laneGap)

  if (variant === "labels") {
    return (
      <div className="relative h-5 mb-1">
        {bounds.map((b, i) => {
          const leftPct = toPercent(b.startMs, layout)
          const rightPct = toPercent(b.endMs, layout)
          const centerPct = (leftPct + rightPct) / 2
          if (centerPct < 0 || centerPct > 100) return null
          return (
            <div key={i} className="absolute -translate-x-1/2" style={{ left: `${centerPct}%` }}>
              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-medium bg-primary/10 text-primary whitespace-nowrap border border-primary/20">
                {b.label}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  // variant === "backgrounds"
  return (
    <div className="absolute inset-0 pointer-events-none z-0" style={{ height: totalHeight }}>
      {bounds.map((b, i) => {
        const leftPct = Math.max(0, toPercent(b.startMs, layout))
        const rightPct = Math.min(100, toPercent(b.endMs, layout))
        if (rightPct <= leftPct) return null
        return (
          <div
            key={`bg-${i}`}
            className="absolute inset-y-0 rounded-sm"
            style={{ left: `${leftPct}%`, width: `${rightPct - leftPct}%`, backgroundColor: b.color }}
          />
        )
      })}
      {bounds.slice(0, -1).map((b, i) => {
        const nextB = bounds[i + 1]
        if (!nextB) return null
        const dividerMs = (b.endMs + nextB.startMs) / 2
        const pct = toPercent(dividerMs, layout)
        if (pct < 0 || pct > 100) return null
        return (
          <div
            key={`div-${i}`}
            className="absolute inset-y-0 w-px border-l border-dashed border-muted-foreground/30"
            style={{ left: `${pct}%` }}
          />
        )
      })}
    </div>
  )
}
