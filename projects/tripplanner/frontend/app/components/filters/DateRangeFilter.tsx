import { useEffect, useMemo, useRef, useState } from "react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { Calendar } from "lucide-react"
import { FilterDualSection } from "./FilterDualSection"

export interface DateRangeValue {
  start: string
  end: string
}

type ChipMode = "none" | "preset" | "custom"

function DateChipContent({
  value,
  onChange,
  defaultValue,
  minDate,
  maxDate,
  uniqueDates,
  direction,
}: {
  value: string
  onChange: (next: string) => void
  defaultValue?: string
  minDate?: string
  maxDate?: string
  uniqueDates?: string[]
  direction: "start" | "end"
}) {
  const sortedDates = useMemo(() => [...(uniqueDates ?? [])].sort(), [uniqueDates])
  const hasPresets = sortedDates.length > 1
  const [mode, setMode] = useState<ChipMode>("none")
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const reset = () => {
    setMode("none")
    setSelectedDate(null)
    onChange(defaultValue ?? "")
  }

  return (
    <>
      {hasPresets && sortedDates.map((date) => {
        const fmt = new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })
        const isSelected = (() => {
          if (mode === "none") return true
          if (mode !== "preset" || !selectedDate) return false
          if (direction === "start") return date >= selectedDate
          return date <= selectedDate
        })()
        return (
          <Button
            key={date}
            type="button"
            variant={isSelected ? "default" : "outline"}
            size="sm"
            className="w-full justify-center"
            onClick={(e) => {
              e.stopPropagation()
              const idx = sortedDates.indexOf(date)
              if (isSelected) {
                if (direction === "start") {
                  const nextIdx = idx + 1
                  if (nextIdx < sortedDates.length) {
                    setMode("preset")
                    setSelectedDate(sortedDates[nextIdx])
                    onChange(sortedDates[nextIdx])
                  } else {
                    reset()
                  }
                } else {
                  const prevIdx = idx - 1
                  if (prevIdx >= 0) {
                    setMode("preset")
                    setSelectedDate(sortedDates[prevIdx])
                    onChange(sortedDates[prevIdx])
                  } else {
                    reset()
                  }
                }
              } else {
                // If re-selecting would include all chips, reset to all
                if (direction === "start" && idx === 0) {
                  reset()
                } else if (direction === "end" && idx === sortedDates.length - 1) {
                  reset()
                } else {
                  setMode("preset")
                  setSelectedDate(date)
                  onChange(date)
                }
              }
            }}
          >
            {fmt}
          </Button>
        )
      })}
      {sortedDates.length === 1 && (
        <span className="text-xs text-muted-foreground">All on same date</span>
      )}
      {hasPresets && (
        <Button
          type="button"
          variant={mode === "custom" ? "default" : "outline"}
          size="sm"
          className="w-full justify-center"
          onClick={(e) => { e.stopPropagation(); setMode(mode === "custom" ? "none" : "custom") }}
        >
          Custom
        </Button>
      )}
      {(sortedDates.length === 0 || mode === "custom") && (
        <div onClick={(e) => e.stopPropagation()}>
          <Input
            type="date"
            value={value}
            min={minDate}
            max={maxDate}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )}
    </>
  )
}

export function useDateChipCounts(
  value: string,
  defaultValue: string | undefined,
  uniqueDates: string[] | undefined,
  direction: "start" | "end",
) {
  const sortedDates = useMemo(() => [...(uniqueDates ?? [])].sort(), [uniqueDates])
  const isActive = value !== "" && value !== (defaultValue ?? "")
  const selectedCount = (() => {
    if (!isActive || sortedDates.length === 0) return 0
    if (direction === "start") return sortedDates.filter((d) => d >= value).length
    return sortedDates.filter((d) => d <= value).length
  })()
  return { selectedCount, totalCount: sortedDates.length, isActive }
}

export interface DateRangeFilterProps {
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
  minDate?: string
  maxDate?: string
  uniqueStartDates?: string[]
  uniqueEndDates?: string[]
  expanded?: boolean
  onToggle?: () => void
  shakeKey?: number
}

export function DateRangeFilter({
  value,
  onChange,
  minDate,
  maxDate,
  uniqueStartDates,
  uniqueEndDates,
  expanded = false,
  onToggle,
  shakeKey = 0,
}: DateRangeFilterProps) {
  const didAutoFill = useRef(false)

  useEffect(() => {
    if (!didAutoFill.current && !value.start && !value.end && minDate && maxDate) {
      didAutoFill.current = true
      onChange({ start: minDate, end: maxDate })
    }
  }, [minDate, maxDate, value.start, value.end, onChange])

  const startCounts = useDateChipCounts(value.start, minDate, uniqueStartDates, "start")
  const endCounts = useDateChipCounts(value.end, maxDate, uniqueEndDates, "end")

  return (
    <FilterDualSection
      icon={<Calendar className="h-6 w-6" />}
      expanded={expanded}
      onToggle={() => onToggle?.()}
      shakeKey={shakeKey}
      left={{
        label: "Start",
        selectedCount: startCounts.isActive ? startCounts.selectedCount : undefined,
        totalCount: startCounts.isActive ? startCounts.totalCount : undefined,
        showCountWhenAll: false,
        showCountWhenNone: false,
        hideCount: true,
        onReset: () => onChange({ ...value, start: minDate ?? "" }),
        children: (
          <DateChipContent
            value={value.start}
            onChange={(start) => onChange({ ...value, start })}
            defaultValue={minDate}
            minDate={minDate}
            maxDate={value.end || maxDate}
            uniqueDates={uniqueStartDates}
            direction="start"
          />
        ),
      }}
      right={{
        label: "End",
        selectedCount: endCounts.isActive ? endCounts.selectedCount : undefined,
        totalCount: endCounts.isActive ? endCounts.totalCount : undefined,
        showCountWhenAll: false,
        showCountWhenNone: false,
        hideCount: true,
        onReset: () => onChange({ ...value, end: maxDate ?? "" }),
        children: (
          <DateChipContent
            value={value.end}
            onChange={(end) => onChange({ ...value, end })}
            defaultValue={maxDate}
            minDate={value.start || minDate}
            maxDate={maxDate}
            uniqueDates={uniqueEndDates}
            direction="end"
          />
        ),
      }}
    />
  )
}
