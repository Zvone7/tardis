// components/RangeDateTimePicker.tsx
"use client"

import React, { useMemo } from "react"
import { Label } from "./ui/label"
import { Input } from "./ui/input"
import { Button } from "./ui/button"
import { TimezoneSelector } from "../components/TimeZoneSelector" // your existing one
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
}

/** Helpers (no timezone libs; pure offset math) */
function pad(n: number) {
  return String(n).padStart(2, "0")
}

/** Build UTC ms from a local wall time and hour offset */
function localToUtcMs(local: string, offsetH: number): number {
  // local is "YYYY-MM-DDTHH:mm"
  if (!local) return Number.NaN
  const [datePart, timePart] = local.split("T")
  const [y, m, d] = datePart.split("-").map((s) => Number.parseInt(s, 10))
  const [hh, mm] = (timePart || "00:00").split(":").map((s) => Number.parseInt(s, 10))
  // Treat local wall-time as if it were UTC components, then subtract offset to get real UTC
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

export const RangeDateTimePicker: React.FC<RangeDateTimePickerProps> = React.memo(
  ({ id, label = "When", value, onChange, allowDifferentOffsets = false, compact = false }) => {
    const { startLocal, endLocal, startOffsetH, endOffsetH } = value

    // Effective end offset (falls back to startOffsetH)
    const effEndOffset = endOffsetH ?? startOffsetH

    // Compute a min for the end field: start instant seen in end offset
    const endMinLocal = useMemo(() => {
      if (!startLocal) return undefined
      const startUtcMs = localToUtcMs(startLocal, startOffsetH)
      if (!Number.isFinite(startUtcMs)) return undefined
      return utcMsToLocal(startUtcMs, effEndOffset)
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

    const grid = compact ? "grid grid-cols-4 items-center gap-2" : "grid grid-cols-4 items-center gap-3"

    return (
      <div className="space-y-3">
        {/* Group label */}
        <div className={grid}>
          <Label htmlFor={`${id}-start`} className="text-right text-sm">
            Start
          </Label>
          <div className="col-span-3 flex items-center gap-2">
            <Input
              id={`${id}-start`}
              type="datetime-local"
              value={startLocal}
              onChange={(e) => onChange({ ...value, startLocal: e.target.value })}
              className="w-full md:w-56 text-sm"
            />

            <TimezoneSelector
              label=""
              value={startOffsetH}
              onChange={(utcOffset) => {
                // Keep the local wall time as typed; just change the offset
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

        {/* End controls */}
        {endLocal === null ? (
          // Collapsed state
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
        ) : (
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
                  onChange={(e) => onChange({ ...value, endLocal: e.target.value })}
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

            {/* Clear end button placed below end inputs, left-aligned */}
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

            <div className={grid}>
              <Label className="text-right text-xs text-muted-foreground" />
              <div className="col-span-3 text-xs text-muted-foreground">
                End must be at the same time or after start.
              </div>
            </div>
          </div>
        )}
      </div>
    )
  },
)

RangeDateTimePicker.displayName = "RangeDateTimePicker"
