import { FilterPanel, hasBaseFilters, countBaseActiveFilters } from "./FilterPanel"
import type { OptionSortValue } from "../sorting/optionSortTypes"
import { OPTION_SORT_FIELDS } from "../sorting/optionSortTypes"
import type { DateRangeValue } from "./DateRangeFilter"
import type { LocationChip } from "../../services/locationLabel"

export interface OptionFilterValue {
  locations: string[] | null
  dateRange: DateRangeValue
  costMin: number | null
  costMax: number | null
  showHidden: boolean
}

interface OptionFilterPanelProps {
  value: OptionFilterValue
  onChange: (value: OptionFilterValue) => void
  sort: OptionSortValue | null
  onSortChange: (value: OptionSortValue | null) => void
  availableLocations: LocationChip[]
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

export function useOptionFilterHasFilters(value: OptionFilterValue, minDate?: string, maxDate?: string) {
  return hasBaseFilters(value, minDate, maxDate)
}

export function countOptionActiveFilters(value: OptionFilterValue, sort: OptionSortValue | null, minDate?: string, maxDate?: string) {
  return countBaseActiveFilters(value, sort, minDate, maxDate)
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
  hiddenCount,
  costMinChips,
  costMaxChips,
  allSameCost,
  currencyLabel,
  className,
}: OptionFilterPanelProps) {
  return (
    <FilterPanel
      value={value}
      onChange={onChange}
      sort={sort}
      onSortChange={onSortChange}
      sortFields={OPTION_SORT_FIELDS}
      availableLocations={availableLocations}
      entityLabel="option"
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
    />
  )
}
