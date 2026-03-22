import { useEffect, useMemo, useRef, useState } from "react"
import { Label } from "../ui/label"
import { Input } from "../ui/input"
import { Button } from "../ui/button"

export interface DateRangeValue {
  start: string
  end: string
}

type ChipMode = "all" | "preset" | "custom"

function DateChipRow({
  label,
  value,
  onChange,
  defaultValue,
  minDate,
  maxDate,
  uniqueDates,
}: {
  label: string
  value: string
  onChange: (next: string) => void
  defaultValue?: string
  minDate?: string
  maxDate?: string
  uniqueDates?: string[]
}) {
  const sortedDates = useMemo(() => [...(uniqueDates ?? [])].sort(), [uniqueDates])
  const hasPresets = sortedDates.length > 1
  const [mode, setMode] = useState<ChipMode>("all")
  const [activePresetIdx, setActivePresetIdx] = useState<number | null>(null)

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {hasPresets && (
        <div className="flex flex-wrap gap-1.5">
          <Button
            type="button"
            variant={mode === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setMode("all")
              setActivePresetIdx(null)
              onChange(defaultValue ?? "")
            }}
          >
            All
          </Button>
          {sortedDates.map((date, idx) => {
            const fmt = new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })
            return (
              <Button
                key={date}
                type="button"
                variant={mode === "preset" && activePresetIdx === idx ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setMode("preset")
                  setActivePresetIdx(idx)
                  onChange(date)
                }}
              >
                {fmt}
              </Button>
            )
          })}
          <Button
            type="button"
            variant={mode === "custom" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("custom")}
          >
            Custom
          </Button>
        </div>
      )}
      {(!hasPresets || mode === "custom") && (
        <Input
          type="date"
          value={value}
          min={minDate}
          max={maxDate}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  )
}

export interface DateRangeFilterProps {
  label?: string
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
  minDate?: string
  maxDate?: string
  uniqueStartDates?: string[]
  uniqueEndDates?: string[]
}

export function DateRangeFilter({
  label = "Date range",
  value,
  onChange,
  minDate,
  maxDate,
  uniqueStartDates,
  uniqueEndDates,
}: DateRangeFilterProps) {
  const didAutoFill = useRef(false)

  useEffect(() => {
    if (!didAutoFill.current && !value.start && !value.end && minDate && maxDate) {
      didAutoFill.current = true
      onChange({ start: minDate, end: maxDate })
    }
  }, [minDate, maxDate, value.start, value.end, onChange])

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <DateChipRow
        label="Start date"
        value={value.start}
        onChange={(start) => onChange({ ...value, start })}
        defaultValue={minDate}
        minDate={minDate}
        maxDate={value.end || maxDate}
        uniqueDates={uniqueStartDates}
      />
      <DateChipRow
        label="End date"
        value={value.end}
        onChange={(end) => onChange({ ...value, end })}
        defaultValue={maxDate}
        minDate={value.start || minDate}
        maxDate={maxDate}
        uniqueDates={uniqueEndDates}
      />
    </div>
  )
}
