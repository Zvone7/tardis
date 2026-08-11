"use client"

import { useMemo } from "react"
import { formatDayNotch } from "../../utils/segmentVisuals"

interface TimelineAxisProps {
  viewportStart: number
  viewportEnd: number
}

interface Tick {
  ms: number
  label: string
}

function buildTicks(windowStart: number, windowEnd: number): Tick[] {
  const range = windowEnd - windowStart
  if (range <= 0) return []

  const MS_HOUR = 3_600_000
  const MS_DAY = 86_400_000

  let intervalMs: number
  if (range < 2 * MS_DAY) {
    intervalMs = 6 * MS_HOUR
  } else if (range < 30 * MS_DAY) {
    intervalMs = MS_DAY
  } else {
    intervalMs = 3 * MS_DAY
  }

  const ticks: Tick[] = []

  const firstDate = new Date(windowStart)
  let cursor: Date
  if (intervalMs === MS_DAY || intervalMs === 3 * MS_DAY) {
    cursor = new Date(Date.UTC(firstDate.getUTCFullYear(), firstDate.getUTCMonth(), firstDate.getUTCDate() + 1))
  } else {
    const hoursUTC = firstDate.getUTCHours()
    const nextH = Math.ceil((hoursUTC + 1) / 6) * 6
    cursor = new Date(firstDate)
    cursor.setUTCHours(nextH, 0, 0, 0)
    if (cursor.getTime() <= windowStart) {
      cursor = new Date(cursor.getTime() + 6 * MS_HOUR)
    }
  }

  while (cursor.getTime() < windowEnd) {
    const ms = cursor.getTime()
    const label =
      intervalMs < MS_DAY
        ? cursor.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
        : formatDayNotch(cursor)
    ticks.push({ ms, label })
    cursor = new Date(cursor.getTime() + intervalMs)
  }

  return ticks
}

export function TimelineAxis({ viewportStart, viewportEnd }: TimelineAxisProps) {
  const range = viewportEnd - viewportStart
  const ticks = useMemo(() => buildTicks(viewportStart, viewportEnd), [viewportStart, viewportEnd])

  if (range <= 0) return null

  return (
    <div className="relative h-8 mt-1 select-none">
      {ticks.map((tick) => {
        const leftPct = ((tick.ms - viewportStart) / range) * 100
        if (leftPct < 0 || leftPct > 100) return null
        return (
          <div
            key={tick.ms}
            className="absolute top-0 flex flex-col items-center"
            style={{ left: `${leftPct}%`, transform: "translateX(-50%)" }}
          >
            <div className="w-px h-1.5 bg-border" />
            <span className="text-[10px] text-muted-foreground whitespace-nowrap mt-0.5">{tick.label}</span>
          </div>
        )
      })}
    </div>
  )
}
