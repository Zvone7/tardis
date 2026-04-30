import { useState } from "react"
import { Button } from "../ui/button"
import { Eye, EyeOff, MapPin, ArrowUpDown, RotateCcw } from "lucide-react"
import { cn } from "../../lib/utils"
import { LocationFilter } from "./LocationFilter"
import type { LocationChip } from "../../services/locationLabel"
import { DateRangeFilter, type DateRangeValue } from "./DateRangeFilter"
import { CostDualFilter } from "./CostDualFilter"
import { FilterSection } from "./FilterSection"

export interface BaseFilterValue {
  locations: string[]
  dateRange: DateRangeValue
  costMin: number | null
  costMax: number | null
  showHidden: boolean
}

export interface BaseSortValue {
  field: string
  direction: "asc" | "desc"
}

interface FilterPanelProps<TFilter extends BaseFilterValue, TSort extends BaseSortValue> {
  value: TFilter
  onChange: (value: TFilter) => void
  sort: TSort | null
  onSortChange: (value: TSort | null) => void
  sortFields: { field: string; label: string }[]
  availableLocations: LocationChip[]
  entityLabel: string
  minDate?: string
  maxDate?: string
  uniqueStartDates?: string[]
  uniqueEndDates?: string[]
  totalCount?: number
  filteredCount?: number
  hiddenCount?: number
  costMinChips?: number[]
  costMaxChips?: number[]
  allSameCost?: boolean
  currencyLabel?: string
  className?: string

  // Extension point for extra filter sections (e.g. segment Types filter)
  // Receives activeSection and toggle so the extra section participates in the accordion
  extraFilters?: (params: { activeSection: string | null; toggle: (section: string) => void; shakeKey: number }) => React.ReactNode
  extraHasFilters?: boolean
  extraResetFields?: Partial<TFilter>
  extraInitialSection?: string | null
}

export function hasBaseFilters(value: BaseFilterValue, minDate?: string, maxDate?: string) {
  const hasDateFilter =
    (value.dateRange.start && value.dateRange.start !== (minDate ?? "")) ||
    (value.dateRange.end && value.dateRange.end !== (maxDate ?? ""))
  return value.locations.length > 0 || !!hasDateFilter || value.costMin != null || value.costMax != null
}

export function countBaseActiveFilters(value: BaseFilterValue, sort: BaseSortValue | null, minDate?: string, maxDate?: string) {
  let count = 0
  if (value.locations.length > 0) count++
  if (value.dateRange.start && value.dateRange.start !== (minDate ?? "")) count++
  if (value.dateRange.end && value.dateRange.end !== (maxDate ?? "")) count++
  if (value.costMin != null) count++
  if (value.costMax != null) count++
  if (sort) count++
  return count
}

export function FilterPanel<TFilter extends BaseFilterValue, TSort extends BaseSortValue>({
  value,
  onChange,
  sort,
  onSortChange,
  sortFields,
  availableLocations,
  entityLabel,
  minDate,
  maxDate,
  uniqueStartDates,
  uniqueEndDates,
  totalCount,
  filteredCount,
  hiddenCount,
  costMinChips,
  costMaxChips,
  allSameCost,
  currencyLabel,
  className,
  extraFilters,
  extraHasFilters,
  extraResetFields,
  extraInitialSection,
}: FilterPanelProps<TFilter, TSort>) {
  const getInitialSection = (): string | null => {
    if (extraInitialSection) return extraInitialSection
    if (value.locations.length > 0) return "locations"
    if (sort) return "sort"
    return null
  }

  const [activeSection, setActiveSection] = useState<string | null>(getInitialSection)
  const [shakeKey, setShakeKey] = useState(0)

  const update = (partial: Partial<BaseFilterValue>) => onChange({ ...value, ...partial } as TFilter)
  const hasFilters = hasBaseFilters(value, minDate, maxDate) || !!extraHasFilters
  const toggle = (section: string) => setActiveSection((prev) => (prev === section ? null : section))

  const handleReset = () => {
    onChange({
      ...value,
      locations: [],
      dateRange: { start: minDate ?? "", end: maxDate ?? "" },
      costMin: null,
      costMax: null,
      ...extraResetFields,
    })
    setShakeKey((k) => k + 1)
  }

  return (
    <div className={cn("w-full", className)}>
      {totalCount != null && filteredCount != null && (() => {
        const visibleCount = totalCount - (hiddenCount ?? 0)
        const baseCount = value.showHidden ? totalCount : visibleCount
        const isFiltered = filteredCount < baseCount
        const hiddenLabel = value.showHidden && (hiddenCount ?? 0) > 0 ? ` (+ ${hiddenCount} hidden)` : ""
        return (
          <div className="w-full text-center mb-2">
            <span className="text-sm text-muted-foreground">
              {isFiltered ? `${filteredCount} of ` : ""}{value.showHidden ? visibleCount : baseCount} {entityLabel}{(value.showHidden ? visibleCount : baseCount) !== 1 ? "s" : ""}{hiddenLabel}
            </span>
          </div>
        )
      })()}

      <div className="flex items-center gap-2">
        {/* Left: Sort + Hidden */}
        <div className="flex items-center gap-2">
          <FilterSection
            label="Sort"
            icon={<ArrowUpDown className="h-6 w-6" />}
            selectNoneByDefault
            expanded={activeSection === "sort"}
            onToggle={() => toggle("sort")}
            selectedCount={sort ? 1 : 0}
            totalCount={sortFields.length}
            showCountWhenAll={true}
            showCountWhenNone={false}
            onReset={() => onSortChange(null)}
          >
            {sortFields.map(({ field, label }) => {
              const isActive = sort?.field === field
              const direction = isActive ? sort?.direction ?? "asc" : "asc"
              const nextDirection = !isActive ? "asc" : direction === "asc" ? "desc" : null
              const indicator = isActive ? (direction === "asc" ? "↑" : "↓") : ""
              return (
                <Button
                  key={field}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (nextDirection === null) onSortChange(null)
                    else onSortChange({ field, direction: nextDirection } as TSort)
                  }}
                >
                  {label} {indicator}
                </Button>
              )
            })}
          </FilterSection>

          <FilterSection
            label="Hidden"
            icon={value.showHidden ? <Eye className="h-6 w-6" /> : <EyeOff className="h-6 w-6" />}
            toggle
            active={value.showHidden && (hiddenCount ?? 0) > 0}
            onToggle={() => update({ showHidden: !value.showHidden })}
            selectedCount={hiddenCount ?? 0}
            totalCount={totalCount ?? 0}
            showCountWhenAll={true}
            showCountWhenNone={false}
          />
        </div>

        <div className="flex-1" />

        {/* Right: Reset + Filters */}
        <div className="flex items-center gap-2 flex-wrap justify-end">

          {hasFilters && (
            <button
              type="button"
              title="Reset all filters"
              className="inline-flex items-center justify-center cursor-pointer p-1 rounded text-red-900 dark:text-red-300 hover:opacity-100 transition-colors opacity-50"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}

          <FilterSection
            label="Locations"
            icon={<MapPin className="h-6 w-6" />}
            selectAllByDefault
            shakeKey={shakeKey}
            expanded={activeSection === "locations"}
            onToggle={() => toggle("locations")}
            selectedCount={value.locations.length === 0 ? availableLocations.length : value.locations.length}
            totalCount={availableLocations.length}
            showCountWhenAll={false}
            showCountWhenNone={true}
            onReset={() => update({ locations: [] })}
          >
            {availableLocations.length <= 1 ? (
              <span className="text-xs text-muted-foreground">All same location</span>
            ) : (
              <LocationFilter locations={availableLocations} value={value.locations} onChange={(locations) => update({ locations })} />
            )}
          </FilterSection>

          {extraFilters?.({ activeSection, toggle, shakeKey })}

          <DateRangeFilter
            value={value.dateRange}
            onChange={(dateRange) => update({ dateRange })}
            minDate={minDate}
            maxDate={maxDate}
            uniqueStartDates={uniqueStartDates}
            uniqueEndDates={uniqueEndDates}
            expanded={activeSection === "dates"}
            onToggle={() => toggle("dates")}
            shakeKey={shakeKey}
          />

          <CostDualFilter
            costMin={value.costMin}
            costMax={value.costMax}
            onCostMinChange={(costMin) => update({ costMin })}
            onCostMaxChange={(costMax) => update({ costMax })}
            costMinChips={costMinChips}
            costMaxChips={costMaxChips}
            allSameCost={allSameCost}
            currencyLabel={currencyLabel}
            expanded={activeSection === "cost"}
            onToggle={() => toggle("cost")}
            shakeKey={shakeKey}
          />

        </div>
      </div>
    </div>
  )
}
