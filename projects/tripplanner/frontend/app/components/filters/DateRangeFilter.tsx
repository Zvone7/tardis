import { useEffect, useMemo, useRef, useState } from "react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import { CalendarArrowUp, CalendarArrowDown } from "lucide-react"
import { FilterSection } from "./FilterSection"

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
      {hasPresets && (
        <>
          {sortedDates.map((date) => {
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
                onClick={(e) => {
                  e.stopPropagation()
                  const idx = sortedDates.indexOf(date)
                  if (isSelected) {
                    // Deselect: move boundary past this chip
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
                    // Select: move boundary to include this chip
                    setMode("preset")
                    setSelectedDate(date)
                    onChange(date)
                  }
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
            onClick={(e) => { e.stopPropagation(); setMode(mode === "custom" ? "none" : "custom") }}
          >
            Custom
          </Button>
        </>
      )}
      {sortedDates.length === 1 && (
        <span className="text-xs text-muted-foreground">All on same date</span>
      )}
      {(sortedDates.length === 0 || mode === "custom") && (
        <div className="w-full mt-1" onClick={(e) => e.stopPropagation()}>
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
  expandedRow?: "start" | "end" | null
  onExpandRow?: (row: "start" | "end") => void
  shakeKey?: number
}

export function DateRangeFilter({
  value,
  onChange,
  minDate,
  maxDate,
  uniqueStartDates,
  uniqueEndDates,
  expandedRow,
  onExpandRow,
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
    <>
      <FilterSection
        label="Start"
        icon={<CalendarArrowUp className="h-6 w-6" />}
        shakeKey={shakeKey}
        expanded={expandedRow === "start"}
        onToggle={() => onExpandRow?.("start")}
        selectedCount={startCounts.isActive ? startCounts.selectedCount : undefined}
        totalCount={startCounts.isActive ? startCounts.totalCount : undefined}
        showCountWhenAll={false}
        showCountWhenNone={false}
        onReset={() => onChange({ ...value, start: minDate ?? "" })}
      >
        <DateChipContent
          value={value.start}
          onChange={(start) => onChange({ ...value, start })}
          defaultValue={minDate}
          minDate={minDate}
          maxDate={value.end || maxDate}
          uniqueDates={uniqueStartDates}
          direction="start"
        />
      </FilterSection>
      <FilterSection
        label="End"
        icon={<CalendarArrowDown className="h-6 w-6" />}
        shakeKey={shakeKey}
        expanded={expandedRow === "end"}
        onToggle={() => onExpandRow?.("end")}
        selectedCount={endCounts.isActive ? endCounts.selectedCount : undefined}
        totalCount={endCounts.isActive ? endCounts.totalCount : undefined}
        showCountWhenAll={false}
        showCountWhenNone={false}
        onReset={() => onChange({ ...value, end: maxDate ?? "" })}
      >
        <DateChipContent
          value={value.end}
          onChange={(end) => onChange({ ...value, end })}
          defaultValue={maxDate}
          minDate={value.start || minDate}
          maxDate={maxDate}
          uniqueDates={uniqueEndDates}
          direction="end"
        />
      </FilterSection>
    </>
  )
}
