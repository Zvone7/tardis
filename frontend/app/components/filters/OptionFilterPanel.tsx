import { useState, type ReactNode } from "react"
import { Button } from "../ui/button"
import { Label } from "../ui/label"
import { Switch } from "../ui/switch"
import { SlidersHorizontal } from "lucide-react"
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
  className?: string
  toolbarAddon?: ReactNode
}

export function OptionFilterPanel({
  value,
  onChange,
  sort,
  onSortChange,
  availableLocations,
  minDate,
  maxDate,
  className,
  toolbarAddon,
}: OptionFilterPanelProps) {
  const [open, setOpen] = useState(false)

  const update = (partial: Partial<OptionFilterValue>) => onChange({ ...value, ...partial })

  const hasDateFilter =
    (value.dateRange.start && value.dateRange.start !== (minDate ?? "")) ||
    (value.dateRange.end && value.dateRange.end !== (maxDate ?? ""))
  const hasFilters = value.locations.length > 0 || hasDateFilter

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
          <LocationFilter locations={availableLocations} value={value.locations} onChange={(locations) => update({ locations })} />
          <DateRangeFilter
            value={value.dateRange}
            onChange={(dateRange) => update({ dateRange })}
            minDate={minDate}
            maxDate={maxDate}
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
      )}
    </div>
  )
}
