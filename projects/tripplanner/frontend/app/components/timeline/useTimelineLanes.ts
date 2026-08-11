"use client"

import { useMemo } from "react"
import type { SegmentApi } from "../../types/models"

export interface TimelineLayout {
  /** segmentId → zero-based lane index */
  laneAssignment: Map<number, number>
  laneCount: number
  /** epoch ms, padded 3% before the earliest segment start */
  windowStart: number
  /** epoch ms, padded 3% after the latest segment end */
  windowEnd: number
  /** windowEnd - windowStart */
  range: number
  /** segments excluded from the timeline because they have no dates */
  undatedIds: Set<number>
}

/** Greedy lane packing: assign each segment to the earliest available lane. Pure, no hooks.
 *  minVisualMs: minimum rendered duration; bars narrower than this get clamped by TimelineBar,
 *  so lane packing uses Math.max(endMs, startMs + minVisualMs) to avoid visual overlap. */
export function assignLanes(
  segments: SegmentApi[],
  minVisualMs = 0,
): { laneAssignment: Map<number, number>; laneCount: number } {
  const dated = segments.filter((s) => s.startDateTimeUtc && s.endDateTimeUtc)
  if (dated.length === 0) return { laneAssignment: new Map(), laneCount: 0 }

  const sorted = [...dated].sort((a, b) => {
    const diff = new Date(a.startDateTimeUtc).getTime() - new Date(b.startDateTimeUtc).getTime()
    if (diff !== 0) return diff
    const durA = new Date(a.endDateTimeUtc).getTime() - new Date(a.startDateTimeUtc).getTime()
    const durB = new Date(b.endDateTimeUtc).getTime() - new Date(b.startDateTimeUtc).getTime()
    return durB - durA
  })

  const laneEnds: number[] = []
  const laneAssignment = new Map<number, number>()

  for (const seg of sorted) {
    const startMs = new Date(seg.startDateTimeUtc).getTime()
    const endMs = new Date(seg.endDateTimeUtc).getTime()
    const visualEnd = Math.max(endMs, startMs + minVisualMs)
    let placed = false
    for (let lane = 0; lane < laneEnds.length; lane++) {
      if (startMs >= laneEnds[lane]) {
        laneEnds[lane] = visualEnd
        laneAssignment.set(seg.id, lane)
        placed = true
        break
      }
    }
    if (!placed) {
      laneAssignment.set(seg.id, laneEnds.length)
      laneEnds.push(visualEnd)
    }
  }

  return { laneAssignment, laneCount: laneEnds.length }
}

export function useTimelineLanes(segments: SegmentApi[]): TimelineLayout {
  return useMemo(() => {
    const dated = segments.filter((s) => s.startDateTimeUtc && s.endDateTimeUtc)
    const undatedIds = new Set(
      segments.filter((s) => !s.startDateTimeUtc || !s.endDateTimeUtc).map((s) => s.id),
    )

    if (dated.length === 0) {
      return { laneAssignment: new Map(), laneCount: 0, windowStart: 0, windowEnd: 0, range: 0, undatedIds }
    }

    const { laneAssignment, laneCount } = assignLanes(dated)

    let minMs = Infinity
    let maxMs = -Infinity
    for (const seg of dated) {
      const s = new Date(seg.startDateTimeUtc).getTime()
      const e = new Date(seg.endDateTimeUtc).getTime()
      if (s < minMs) minMs = s
      if (e > maxMs) maxMs = e
    }
    const rawRange = maxMs - minMs
    const padding = rawRange * 0.03 || 3_600_000
    const windowStart = minMs - padding
    const windowEnd = maxMs + padding
    const range = windowEnd - windowStart

    return { laneAssignment, laneCount, windowStart, windowEnd, range, undatedIds }
  }, [segments])
}

/** Convert an epoch ms timestamp to a left-percentage within a window */
export function toPercent(ms: number, layout: { windowStart: number; range: number }): number {
  if (layout.range === 0) return 0
  return ((ms - layout.windowStart) / layout.range) * 100
}
