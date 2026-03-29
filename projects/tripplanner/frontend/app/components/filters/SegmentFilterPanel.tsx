import { LayoutIcon } from "lucide-react"
import { FilterPanel, hasBaseFilters, countBaseActiveFilters } from "./FilterPanel"
import { FilterSection } from "./FilterSection"
import { SegmentTypeFilter } from "./SegmentTypeFilter"
import type { SegmentType } from "../../types/models"
import type { SegmentSortValue } from "../sorting/segmentSortTypes"
import { SEGMENT_SORT_FIELDS } from "../sorting/segmentSortTypes"
import type { DateRangeValue } from "./DateRangeFilter"

export interface SegmentFilterValue {
  locations: string[]
  types: string[]
  dateRange: DateRangeValue
  costMin: number | null
  costMax: number | null
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
  return hasBaseFilters(value, minDate, maxDate) || value.types.length > 0
}

export function countSegmentActiveFilters(value: SegmentFilterValue, sort: SegmentSortValue | null, minDate?: string, maxDate?: string) {
  return countBaseActiveFilters(value, sort, minDate, maxDate) + (value.types.length > 0 ? 1 : 0)
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
  return (
    <FilterPanel
      value={value}
      onChange={onChange}
      sort={sort}
      onSortChange={onSortChange}
      sortFields={SEGMENT_SORT_FIELDS}
      availableLocations={availableLocations}
      entityLabel="segment"
      minDate={minDate}
      maxDate={maxDate}
      uniqueStartDates={uniqueStartDates}
      uniqueEndDates={uniqueEndDates}
      totalCount={totalCount}
      filteredCount={filteredCount}
      hiddenCount={hiddenCount}
      costMinChips={costMinChips}
      costMaxChips={costMaxChips}
      allSameCost={allSameCost}
      currencyLabel={currencyLabel}
      className={className}
      extraHasFilters={value.types.length > 0}
      extraResetFields={{ types: [] }}
      extraInitialSection={value.types.length > 0 ? "types" : null}
      extraFilters={({ activeSection, toggle, shakeKey }) => (
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
          onReset={() => onChange({ ...value, types: [] })}
        >
          {availableTypes.length <= 1 ? (
            <span className="text-xs text-muted-foreground">All same type</span>
          ) : (
            <SegmentTypeFilter types={availableTypes} value={value.types} onChange={(types) => onChange({ ...value, types })} />
          )}
        </FilterSection>
      )}
    />
  )
}
