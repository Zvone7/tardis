import type { SegmentType } from "../types/models"

export const TYPE_COLORS: Record<string, string> = {
  transport_plane: "#0ea5e9",
  transport_train: "#22c55e",
  transport_car: "#ef4444",
  transport_bus: "#f97316",
  transport_other: "#a855f7",
  accomodation_hotel: "#0ea5e9",
  accomodation_hostel: "#22c55e",
  accomodation_airbnb: "#ef4444",
  accomodation_other: "#a855f7",
}

export function segmentColor(segType: SegmentType | null | undefined): string {
  if (segType?.color?.trim()) return segType.color.trim()
  if (!segType?.shortName) return "#6b7280"
  return TYPE_COLORS[segType.shortName] ?? "#6b7280"
}

export function isTransportType(segType: SegmentType | null | undefined): boolean {
  return Boolean(segType?.shortName?.startsWith("transport_"))
}

export function isAccommodationType(segType: SegmentType | null | undefined): boolean {
  return Boolean(segType?.shortName?.startsWith("accomodation_"))
}

export function formatDateCompact(iso?: string | null): string {
  if (!iso) return "N/A"
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "N/A"
  const weekday = date.toLocaleDateString(undefined, { weekday: "short" })
  const dayMonth = date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
  const timeLabel = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  return `${weekday}, ${dayMonth} · ${timeLabel}`
}

/** Format a date as "4 April" (no year) for timeline day notches */
export function formatDayNotch(date: Date): string {
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long" })
}

/** Format a date as "4 April · 14:30" for start/end markers */
export function formatDayNotchWithTime(date: Date): string {
  const day = date.toLocaleDateString(undefined, { day: "numeric", month: "long" })
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  return `${day} · ${time}`
}
