export type SegmentSortField = "startDate" | "endDate" | "segmentType" | "startLocation" | "endLocation" | "cost"
export type SortDirection = "asc" | "desc"

export interface SegmentSortValue {
  field: SegmentSortField
  direction: SortDirection
}

export const SEGMENT_SORT_FIELDS: { field: SegmentSortField; label: string }[] = [
  { field: "startDate", label: "Start date" },
  { field: "endDate", label: "End date" },
  { field: "segmentType", label: "Type" },
  { field: "startLocation", label: "Start location" },
  { field: "endLocation", label: "End location" },
  { field: "cost", label: "Cost" },
]
