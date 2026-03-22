import { useState } from "react"
import { Button } from "../ui/button"
import { Eye, EyeOff, MapPin, LayoutIcon, ArrowUpDown, RotateCcw, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "../../lib/utils"
import { LocationFilter } from "./LocationFilter"
import { SegmentTypeFilter } from "./SegmentTypeFilter"
import { DateRangeFilter, type DateRangeValue } from "./DateRangeFilter"
import { FilterSection } from "./FilterSection"
import type { SegmentType } from "../../types/models"
import type { SegmentSortValue } from "../sorting/segmentSortTypes"
import { SEGMENT_SORT_FIELDS } from "../sorting/segmentSortTypes"

export interface SegmentFilterValue {
  locations: string[]
  types: string[]
  dateRange: DateRangeValue
  costMin: number | null
  costMax: number | null
  showHidden: boolean
}

type Section = "locations" | "types" | "start" | "end" | "costMin" | "costMax" | "sort" | null

interface SegmentFilterPanelProps {
  value: SegmentFilterValue
  onChange: (value: SegmentFilterValue) => void
  sort: SegmentSortValue | null
  onSortChange: (value: SegmentSortValue | null) => void
  availableLocations: string[]
  availableTypes: SegmentType[]
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
}

export function useSegmentFilterHasFilters(value: SegmentFilterValue, minDate?: string, maxDate?: string) {
  const hasDateFilter =
    (value.dateRange.start && value.dateRange.start !== (minDate ?? "")) ||
    (value.dateRange.end && value.dateRange.end !== (maxDate ?? ""))
  return value.locations.length > 0 || value.types.length > 0 || hasDateFilter || value.costMin != null || value.costMax != null
}

export function countSegmentActiveFilters(value: SegmentFilterValue, sort: SegmentSortValue | null, minDate?: string, maxDate?: string) {
  let count = 0
  if (value.locations.length > 0) count++
  if (value.types.length > 0) count++
  if (value.dateRange.start && value.dateRange.start !== (minDate ?? "")) count++
  if (value.dateRange.end && value.dateRange.end !== (maxDate ?? "")) count++
  if (value.costMin != null) count++
  if (value.costMax != null) count++
  if (sort) count++
  return count
}

function getInitialSection(value: SegmentFilterValue, sort: SegmentSortValue | null): Section {
  if (value.locations.length > 0) return "locations"
  if (value.types.length > 0) return "types"
  if (sort) return "sort"
  return null
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
}: SegmentFilterPanelProps) {
  const [activeSection, setActiveSection] = useState<Section>(() => getInitialSection(value, sort))
  const [shakeKey, setShakeKey] = useState(0)
  const update = (partial: Partial<SegmentFilterValue>) => onChange({ ...value, ...partial })
  const hasFilters = useSegmentFilterHasFilters(value, minDate, maxDate)

  const toggle = (section: Section) => setActiveSection((prev) => (prev === section ? null : section))

  const handleReset = () => {
    onChange({
      locations: [],
      types: [],
      dateRange: { start: minDate ?? "", end: maxDate ?? "" },
      costMin: null,
      costMax: null,
      showHidden: value.showHidden,
    })
    setShakeKey((k) => k + 1)
  }

  return (
    <div className={cn("max-w-[1000px]", className)}>
      {totalCount != null && filteredCount != null && (() => {
        const visibleTotal = value.showHidden ? totalCount : totalCount - (hiddenCount ?? 0)
        const isFiltered = filteredCount !== visibleTotal
        return (
          <div className="w-full text-center mb-2">
            <span className="text-sm text-muted-foreground">
              {isFiltered ? `${filteredCount} of ${visibleTotal}` : visibleTotal} segment{visibleTotal !== 1 ? "s" : ""}
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
            totalCount={SEGMENT_SORT_FIELDS.length}
            showCountWhenAll={true}
            showCountWhenNone={false}
            onReset={() => onSortChange(null)}
          >
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
                  onClick={(e) => {
                    e.stopPropagation()
                    if (nextDirection === null) onSortChange(null)
                    else onSortChange({ field: field as SegmentSortValue["field"], direction: nextDirection })
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

        {/* Right: Filters + Reset */}
        <div className="flex items-center gap-2 flex-wrap justify-end">

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

      <FilterSection
        label="Types"
        icon={<LayoutIcon className="h-6 w-6" />}
        selectAllByDefault
        shakeKey={shakeKey}
        expanded={activeSection === "types"}
        onToggle={() => toggle("types")}
        selectedCount={value.types.length === 0 ? availableTypes.length : value.types.length}
        totalCount={availableTypes.length}
        showCountWhenAll={false}
        showCountWhenNone={true}
        onReset={() => update({ types: [] })}
      >
        {availableTypes.length <= 1 ? (
          <span className="text-xs text-muted-foreground">All same type</span>
        ) : (
          <SegmentTypeFilter types={availableTypes} value={value.types} onChange={(types) => update({ types })} />
        )}
      </FilterSection>

      <DateRangeFilter
        value={value.dateRange}
        onChange={(dateRange) => update({ dateRange })}
        minDate={minDate}
        maxDate={maxDate}
        uniqueStartDates={uniqueStartDates}
        uniqueEndDates={uniqueEndDates}
        expandedRow={activeSection === "start" ? "start" : activeSection === "end" ? "end" : null}
        onExpandRow={(row) => toggle(row)}
        shakeKey={shakeKey}
      />

            <FilterSection
          label={`Min cost${currencyLabel ? ` (${currencyLabel})` : ""}`}
          icon={<TrendingUp className="h-6 w-6" />}
          shakeKey={shakeKey}
          expanded={activeSection === "costMin"}
          onToggle={() => toggle("costMin")}
          selectedCount={value.costMin != null ? (costMinChips ?? []).filter((c) => c >= value.costMin!).length : undefined}
          totalCount={value.costMin != null ? (costMinChips ?? []).length : undefined}
          showCountWhenAll={false}
          showCountWhenNone={false}
          onReset={() => update({ costMin: null })}
        >
          {allSameCost ? (
            <span className="text-xs text-muted-foreground">All same cost</span>
          ) : (costMinChips ?? []).map((amount, idx, arr) => {
            const isSelected = value.costMin == null || amount >= value.costMin
            return (
              <Button
                key={amount}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  if (isSelected) {
                    // Deselect: move boundary to next chip (or reset if last)
                    const nextIdx = idx + 1
                    update({ costMin: nextIdx < arr.length ? arr[nextIdx] : null })
                  } else {
                    // Select: move boundary down to this chip
                    update({ costMin: amount })
                  }
                }}
              >
                ≥ {amount.toLocaleString()}
              </Button>
            )
          })}
        </FilterSection>

      <FilterSection
          label={`Max cost${currencyLabel ? ` (${currencyLabel})` : ""}`}
          icon={<TrendingDown className="h-6 w-6" />}
          shakeKey={shakeKey}
          expanded={activeSection === "costMax"}
          onToggle={() => toggle("costMax")}
          selectedCount={value.costMax != null ? (costMaxChips ?? []).filter((c) => c <= value.costMax!).length : undefined}
          totalCount={value.costMax != null ? (costMaxChips ?? []).length : undefined}
          showCountWhenAll={false}
          showCountWhenNone={false}
          onReset={() => update({ costMax: null })}
        >
          {allSameCost ? (
            <span className="text-xs text-muted-foreground">All same cost</span>
          ) : (costMaxChips ?? []).map((amount, idx, arr) => {
            const isSelected = value.costMax == null || amount <= value.costMax
            return (
              <Button
                key={amount}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  if (isSelected) {
                    // Deselect: move boundary to previous chip (or reset if first)
                    const prevIdx = idx - 1
                    update({ costMax: prevIdx >= 0 ? arr[prevIdx] : null })
                  } else {
                    // Select: move boundary up to this chip
                    update({ costMax: amount })
                  }
                }}
              >
                ≤ {amount.toLocaleString()}
              </Button>
            )
          })}
        </FilterSection>

      {hasFilters && (
        <button
          type="button"
          title="Reset all filters"
          className="inline-flex items-center justify-center cursor-pointer rounded-md border border-border/50 hover:border-border p-2 transition-colors"
          onClick={handleReset}
        >
          <RotateCcw className="h-6 w-6" />
        </button>
      )}
        </div>
      </div>
    </div>
  )
}
