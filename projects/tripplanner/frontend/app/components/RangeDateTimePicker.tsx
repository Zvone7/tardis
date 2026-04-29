// components/RangeDateTimePicker.tsx
"use client"

import React, { useMemo, useEffect, useRef } from "react"
import { Label } from "./ui/label"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { TimezoneSelector } from "../components/TimeZoneSelector"
import { ArrowLeftRight } from "lucide-react"

export interface RangeDateTimePickerValue {
  /** "YYYY-MM-DDTHH:mm" */
  startLocal: string
  /** "YYYY-MM-DDTHH:mm" | null (null => same as start) */
  endLocal: string | null
  /** integer hours, e.g. +1, -5 */
  startOffsetH: number
  /** integer hours or null (null => same as startOffsetH) */
  endOffsetH: number | null
}

interface RangeDateTimePickerProps {
  id: string
  label?: string
  value: RangeDateTimePickerValue
  onChange: (next: RangeDateTimePickerValue) => void
  /** default: false. If true, show separate TZ for end */
  allowDifferentOffsets?: boolean
  /** default: false. If true, compact spacing */
  compact?: boolean
  /** default: false. If true, end time is always shown and cannot be removed */
  requireEnd?: boolean
  /** default: false. If true, show "X nights" count when both start and end are set */
  showNights?: boolean
}

/** Helpers (no timezone libs; pure offset math) */
function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** Build UTC ms from a local wall time and hour offset */
function localToUtcMs(local: string, offsetH: number): number {
  if (!local) return Number.NaN
  const [datePart, timePart] = local.split("T")
  const [y, m, d] = datePart.split("-").map((s) => Number.parseInt(s, 10))
  const [hh, mm] = (timePart || "00:00").split(":").map((s) => Number.parseInt(s, 10))
  const asUtc = Date.UTC(y, (m ?? 1) - 1, d ?? 1, hh ?? 0, mm ?? 0, 0, 0)
  return asUtc - offsetH * 60 * 60 * 1000
}

/** Convert a UTC ms + hour offset to a local input value "YYYY-MM-DDTHH:mm" */
function utcMsToLocal(utcMs: number, offsetH: number): string {
  if (!Number.isFinite(utcMs)) return ""
  const localMs = utcMs + offsetH * 60 * 60 * 1000
  const d = new Date(localMs)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(
    d.getUTCHours(),
  )}:${pad(d.getUTCMinutes())}`
}

/** Round a "YYYY-MM-DDTHH:mm" string to the nearest 5-minute mark */
function roundToFiveMinutes(val: string): string {
  if (!val) return val
  const [date, time] = val.split("T")
  if (!time) return val
  const [hhStr, mmStr] = time.split(":")
  const hh = Number.parseInt(hhStr ?? "0", 10)
  const mm = Number.parseInt(mmStr ?? "0", 10)
  const rounded = Math.round(mm / 5) * 5
  const overflow = rounded >= 60
  const finalH = overflow ? (hh + 1) % 24 : hh
  const finalM = overflow ? 0 : rounded
  return `${date}T${pad(finalH)}:${pad(finalM)}`
}

/** Format a duration in ms to a human-readable string (Xh Ym or +X days) */
function formatDuration(durationMs: number): string {
  if (durationMs <= 0) return ""
  const totalMinutes = Math.round(durationMs / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  if (days >= 1) {
    return `+${days} ${days === 1 ? "day" : "days"}`
  }
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

const MIN_GAP_MS = 5 * 60 * 1000 // 5 minutes

export const RangeDateTimePicker: React.FC<RangeDateTimePickerProps> = React.memo(
  ({ id, label = "When", value, onChange, allowDifferentOffsets = false, compact = false, requireEnd = false, showNights = false }) => {
    const { startLocal, endLocal, startOffsetH, endOffsetH } = value

    const effEndOffset = endOffsetH ?? startOffsetH

    // Track previous start to detect when it moves later (to auto-advance end)
    const prevStartUtcMsRef = useRef<number>(Number.NaN)

    // Auto-advance end time if start moves later and end would be < 5 min after start
    useEffect(() => {
      if (!startLocal || endLocal === null) return
      const startUtcMs = localToUtcMs(startLocal, startOffsetH)
      if (!Number.isFinite(startUtcMs)) return

      const endUtcMs = localToUtcMs(endLocal, effEndOffset)
      const minEndUtcMs = startUtcMs + MIN_GAP_MS

      if (!Number.isFinite(endUtcMs) || endUtcMs < minEndUtcMs) {
        const newEndLocal = utcMsToLocal(minEndUtcMs, effEndOffset)
        onChange({ ...value, endLocal: newEndLocal })
      }

      prevStartUtcMsRef.current = startUtcMs
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startLocal, startOffsetH, endLocal, effEndOffset])

    // Compute nights count from calendar date diff (ignoring time)
    const nightsCount = useMemo(() => {
      if (!showNights || !startLocal || !endLocal) return null
      const startDate = startLocal.split("T")[0]
      const endDate = endLocal.split("T")[0]
      if (!startDate || !endDate) return null
      const startMs = new Date(startDate).getTime()
      const endMs = new Date(endDate).getTime()
      const nights = Math.round((endMs - startMs) / (1000 * 60 * 60 * 24))
      return nights > 0 ? nights : null
    }, [showNights, startLocal, endLocal])

    // Duration label for non-accommodation (shows hours/minutes or days)
    const durationLabel = useMemo(() => {
      if (showNights) return null // accommodation uses nights count instead
      if (!startLocal || !endLocal) return null
      const startUtcMs = localToUtcMs(startLocal, startOffsetH)
      const endUtcMs = localToUtcMs(endLocal, effEndOffset)
      if (!Number.isFinite(startUtcMs) || !Number.isFinite(endUtcMs)) return null
      const durationMs = endUtcMs - startUtcMs
      if (durationMs <= 0) return null
      return formatDuration(durationMs)
    }, [showNights, startLocal, endLocal, startOffsetH, effEndOffset])

    // Compute a min for the end field: start instant + 5 min seen in end offset
    const endMinLocal = useMemo(() => {
      if (!startLocal) return undefined
      const startUtcMs = localToUtcMs(startLocal, startOffsetH)
      if (!Number.isFinite(startUtcMs)) return undefined
      return utcMsToLocal(startUtcMs + MIN_GAP_MS, effEndOffset)
    }, [startLocal, startOffsetH, effEndOffset])

    const handleSwap = () => {
      if (endLocal) {
        onChange({
          ...value,
          startLocal: endLocal,
          endLocal: startLocal,
          startOffsetH: effEndOffset,
          endOffsetH: allowDifferentOffsets ? startOffsetH : null,
        })
      }
    }

    const handleStartChange = (raw: string) => {
      onChange({ ...value, startLocal: roundToFiveMinutes(raw) })
    }

    const handleEndChange = (raw: string) => {
      onChange({ ...value, endLocal: roundToFiveMinutes(raw) })
    }

    const grid = compact ? "grid grid-cols-4 items-center gap-2" : "grid grid-cols-4 items-center gap-3"

    return (
      <div className="space-y-3">
        <div className={grid}>
          <Label htmlFor={`${id}-start`} className="text-right text-sm">
            Start
          </Label>
          <div className="col-span-3 flex items-center gap-2">
            <Input
              id={`${id}-start`}
              type="datetime-local"
              value={startLocal}
              step={300}
              onChange={(e) => handleStartChange(e.target.value)}
              className="w-full md:w-56 text-sm"
            />
            <TimezoneSelector
              label=""
              value={startOffsetH}
              onChange={(utcOffset) => {
                onChange({ ...value, startOffsetH: utcOffset })
              }}
              id={`${id}-start-tz`}
              compact
            />
          </div>
        </div>

        {endLocal !== null && (
          <div className={grid}>
            <Label className="text-right text-sm" />
            <div className="col-span-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleSwap}
                className="h-8 px-2"
                title="Swap start and end times"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {endLocal === null && !requireEnd ? (
          <div className={grid}>
            <Label className="text-right text-sm" />
            <div className="col-span-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onChange({
                    ...value,
                    endLocal: value.startLocal || "",
                    endOffsetH: allowDifferentOffsets ? value.startOffsetH : null,
                  })
                }
              >
                + Add end time
              </Button>
            </div>
          </div>
        ) : endLocal !== null ? (
          <div className="space-y-2">
            <div className={grid}>
              <Label htmlFor={`${id}-end`} className="text-right text-sm">
                End
              </Label>
              <div className="col-span-3 flex items-center gap-2">
                <Input
                  id={`${id}-end`}
                  type="datetime-local"
                  value={endLocal}
                  min={endMinLocal}
                  step={300}
                  onChange={(e) => handleEndChange(e.target.value)}
                  className="w-full md:w-56 text-sm"
                />
                {allowDifferentOffsets ? (
                  <TimezoneSelector
                    label=""
                    value={effEndOffset}
                    onChange={(utcOffset) => onChange({ ...value, endOffsetH: utcOffset })}
                    id={`${id}-end-tz`}
                    compact
                  />
                ) : (
                  <div className="text-xs text-muted-foreground">
                    UTC{startOffsetH >= 0 ? "+" : ""}
                    {startOffsetH}
                  </div>
                )}
              </div>
            </div>

            {/* Duration / nights display */}
            {nightsCount !== null && (
              <div className={grid}>
                <Label className="text-right text-sm" />
                <div className="col-span-3 text-sm text-muted-foreground">
                  {nightsCount} {nightsCount === 1 ? "night" : "nights"}
                </div>
              </div>
            )}
            {durationLabel && (
              <div className={grid}>
                <Label className="text-right text-sm" />
                <div className="col-span-3 text-sm text-muted-foreground">
                  {durationLabel}
                </div>
              </div>
            )}

            {!requireEnd && (
              <div className={grid}>
                <Label className="text-right text-sm" />
                <div className="col-span-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onChange({ ...value, endLocal: null, endOffsetH: null })}
                  >
                    Remove end time
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    )
  },
)

RangeDateTimePicker.displayName = "RangeDateTimePicker"
