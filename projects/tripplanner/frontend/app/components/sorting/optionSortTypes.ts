export type OptionSortField = "startDate" | "endDate" | "totalCost" | "totalDays"
export type SortDirection = "asc" | "desc"

export interface OptionSortValue {
  field: OptionSortField
  direction: SortDirection
}

export const OPTION_SORT_FIELDS: { field: OptionSortField; label: string }[] = [
  { field: "startDate", label: "Start date" },
  { field: "endDate", label: "End date" },
  { field: "totalCost", label: "Total cost" },
  { field: "totalDays", label: "Total days" },
]
