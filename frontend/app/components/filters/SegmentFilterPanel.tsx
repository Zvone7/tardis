import { useState, type ReactNode } from "react"
import { Button } from "../ui/button"
import { Label } from "../ui/label"
import { Switch } from "../ui/switch"
import { SlidersHorizontal } from "lucide-react"
import { cn } from "../../lib/utils"
import { LocationFilter } from "./LocationFilter"
import { SegmentTypeFilter } from "./SegmentTypeFilter"
import { DateRangeFilter, type DateRangeValue } from "./DateRangeFilter"
import type { SegmentType } from "../../types/models"
import type { SegmentSortValue } from "../sorting/segmentSortTypes"
import { SEGMENT_SORT_FIELDS } from "../sorting/segmentSortTypes"

export interface SegmentFilterValue {
  locations: string[]
  types: string[]
  dateRange: DateRangeValue
  showHidden: boolean
}

interface SegmentFilterPanelProps {
  value: SegmentFilterValue
  onChange: (value: SegmentFilterValue) => void
  sort: SegmentSortValue | null
  onSortChange: (value: SegmentSortValue | null) => void
  availableLocations: string[]
  availableTypes: SegmentType[]
  minDate?: string
  maxDate?: string
  className?: string
  toolbarAddon?: ReactNode
}

export function SegmentFilterPanel({
  value,
  onChange,
  sort,
  onSortChange,
  availableLocations,
  availableTypes,
  minDate,
  maxDate,
  className,
  toolbarAddon,
}: SegmentFilterPanelProps) {
  const [open, setOpen] = useState(false)

  const update = (partial: Partial<SegmentFilterValue>) => {
    onChange({ ...value, ...partial })
  }

  const hasDateFilter =
    (value.dateRange.start && value.dateRange.start !== (minDate ?? "")) ||
    (value.dateRange.end && value.dateRange.end !== (maxDate ?? ""))
  const hasFilters = value.locations.length > 0 || value.types.length > 0 || hasDateFilter

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-end gap-3 sm:flex-nowrap">
        {toolbarAddon ? <div className="min-w-[140px] sm:min-w-[160px]">{toolbarAddon}</div> : null}
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Toggle filters"
          onClick={() => setOpen((prev) => !prev)}
          className={cn("shrink-0 h-9 w-9 border-muted-foreground/50 text-muted-foreground relative", toolbarAddon ? "" : "ml-auto")}
        >
          <SlidersHorizontal
            className={cn("h-5 w-5 transition-transform", open ? "text-primary rotate-90" : "text-muted-foreground")}
          />
          {hasFilters ? <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-primary" /> : null}
        </Button>
      </div>

      {open && (
        <div className="space-y-4 rounded-md border p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <LocationFilter locations={availableLocations} value={value.locations} onChange={(locations) => update({ locations })} />
            <SegmentTypeFilter types={availableTypes} value={value.types} onChange={(types) => update({ types })} />
          </div>

          <DateRangeFilter
            value={value.dateRange}
            onChange={(dateRange) => update({ dateRange })}
            minDate={minDate}
            maxDate={maxDate}
          />

          <div>
            <Label className="text-sm font-medium mb-1 block">Sort by</Label>
            <div className="flex flex-wrap gap-2">
              {SEGMENT_SORT_FIELDS.map(({ field, label }) => {
                const isActive = sort?.field === field
                const direction = isActive ? sort?.direction ?? "asc" : "asc"
                const nextDirection = !isActive ? "asc" : direction === "asc" ? "desc" : null
                const indicator = isActive ? (direction === "asc" ? "↑" : "↓") : ""
                return (
                  <Button
                    key={field}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (nextDirection === null) onSortChange(null)
                      else onSortChange({ field: field as SegmentSortValue["field"], direction: nextDirection })
                    }}
                  >
                    {label} {indicator}
                  </Button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span>Show hidden segments</span>
              <Switch checked={value.showHidden} onCheckedChange={(checked) => update({ showHidden: Boolean(checked) })} />
            </div>
            {hasFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    locations: [],
                    types: [],
                    dateRange: { start: minDate ?? "", end: maxDate ?? "" },
                    showHidden: value.showHidden,
                  })
                }
              >
                Reset filters
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
