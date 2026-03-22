import { Button } from "../ui/button"
import { Label } from "../ui/label"
import { Switch } from "../ui/switch"
import { cn } from "../../lib/utils"
import { LocationFilter } from "./LocationFilter"
import { DateRangeFilter, type DateRangeValue } from "./DateRangeFilter"
import type { OptionSortValue } from "../sorting/optionSortTypes"
import { OPTION_SORT_FIELDS } from "../sorting/optionSortTypes"

export interface OptionFilterValue {
  locations: string[]
  dateRange: DateRangeValue
  showHidden: boolean
}

interface OptionFilterPanelProps {
  value: OptionFilterValue
  onChange: (value: OptionFilterValue) => void
  sort: OptionSortValue | null
  onSortChange: (value: OptionSortValue | null) => void
  availableLocations: string[]
  minDate?: string
  maxDate?: string
  uniqueStartDates?: string[]
  uniqueEndDates?: string[]
  totalCount?: number
  filteredCount?: number
  className?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function useOptionFilterHasFilters(value: OptionFilterValue, minDate?: string, maxDate?: string) {
  const hasDateFilter =
    (value.dateRange.start && value.dateRange.start !== (minDate ?? "")) ||
    (value.dateRange.end && value.dateRange.end !== (maxDate ?? ""))
  return value.locations.length > 0 || hasDateFilter
}

export function OptionFilterPanel({
  value,
  onChange,
  sort,
  onSortChange,
  availableLocations,
  minDate,
  maxDate,
  uniqueStartDates,
  uniqueEndDates,
  totalCount,
  filteredCount,
  className,
  open,
  onOpenChange,
}: OptionFilterPanelProps) {
  const update = (partial: Partial<OptionFilterValue>) => onChange({ ...value, ...partial })

  const hasFilters = useOptionFilterHasFilters(value, minDate, maxDate)

  if (!open) return null

  return (
    <div className={cn("space-y-4 rounded-md border p-4", className)}>
      {totalCount != null && filteredCount != null && (
        <span className="text-sm text-muted-foreground">
          Showing {filteredCount} of {totalCount}
        </span>
      )}
      <div>
        <Label className="text-sm font-medium mb-1.5 block">Locations</Label>
        <LocationFilter locations={availableLocations} value={value.locations} onChange={(locations) => update({ locations })} />
      </div>
      <DateRangeFilter
        value={value.dateRange}
        onChange={(dateRange) => update({ dateRange })}
        minDate={minDate}
        maxDate={maxDate}
        uniqueStartDates={uniqueStartDates}
        uniqueEndDates={uniqueEndDates}
      />
      <div>
        <Label className="text-sm font-medium mb-1 block">Sort by</Label>
        <div className="flex flex-wrap gap-2">
          {OPTION_SORT_FIELDS.map(({ field, label }) => {
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
                  else onSortChange({ field: field as OptionSortValue["field"], direction: nextDirection })
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
          <span>Show hidden options</span>
          <Switch checked={value.showHidden} onCheckedChange={(checked) => update({ showHidden: Boolean(checked) })} />
        </div>
        <div className="flex items-center gap-2">
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                onChange({
                  locations: [],
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
    </div>
  )
}
