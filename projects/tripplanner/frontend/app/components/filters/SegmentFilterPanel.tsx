import { Button } from "../ui/button"
import { Label } from "../ui/label"
import { Switch } from "../ui/switch"
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
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function useSegmentFilterHasFilters(value: SegmentFilterValue, minDate?: string, maxDate?: string) {
  const hasDateFilter =
    (value.dateRange.start && value.dateRange.start !== (minDate ?? "")) ||
    (value.dateRange.end && value.dateRange.end !== (maxDate ?? ""))
  return value.locations.length > 0 || value.types.length > 0 || hasDateFilter
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
  open,
  onOpenChange,
}: SegmentFilterPanelProps) {
  const update = (partial: Partial<SegmentFilterValue>) => {
    onChange({ ...value, ...partial })
  }

  const hasFilters = useSegmentFilterHasFilters(value, minDate, maxDate)

  if (!open) return null

  return (
    <div className={cn("space-y-4 rounded-md border p-4", className)}>
      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Locations</Label>
          <LocationFilter locations={availableLocations} value={value.locations} onChange={(locations) => update({ locations })} />
        </div>
        <div>
          <Label className="text-sm font-medium mb-1.5 block">Segment types</Label>
          <SegmentTypeFilter types={availableTypes} value={value.types} onChange={(types) => update({ types })} />
        </div>
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
  )
}
