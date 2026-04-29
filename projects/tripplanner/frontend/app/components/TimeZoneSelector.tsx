"use client"

import React, { useMemo } from "react"
import { Label } from "./ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { cn } from "../lib/utils"

interface TimezoneSelectorProps {
  label: string
  value: number
  onChange: (utcOffset: number) => void
  id: string
  compact?: boolean
  layout?: "inline" | "stacked"
  className?: string
  selectClassName?: string
}

const timezones = [
  { name: "UTC-12 (Baker Island)", value: -12 },
  { name: "UTC-11 (American Samoa)", value: -11 },
  { name: "UTC-10 (Hawaii)", value: -10 },
  { name: "UTC-9 (Alaska)", value: -9 },
  { name: "America/Los_Angeles", value: -8 },
  { name: "America/Denver", value: -7 },
  { name: "America/Chicago", value: -6 },
  { name: "America/New_York", value: -5 },
  { name: "UTC-4 (Atlantic)", value: -4 },
  { name: "UTC-3 (Buenos Aires)", value: -3 },
  { name: "UTC-2", value: -2 },
  { name: "UTC-1 (Azores)", value: -1 },
  { name: "Europe/London", value: 0 },
  { name: "Europe/Paris/Berlin", value: 1 },
  { name: "Europe/Helsinki/Athens", value: 2 },
  { name: "Europe/Moscow", value: 3 },
  { name: "Asia/Dubai", value: 4 },
  { name: "Asia/Kolkata", value: 5 },
  { name: "UTC+6 (Almaty)", value: 6 },
  { name: "Asia/Bangkok/Jakarta", value: 7 },
  { name: "Asia/Shanghai", value: 8 },
  { name: "Asia/Tokyo", value: 9 },
  { name: "Australia/Sydney", value: 10 },
  { name: "UTC+11 (Noumea)", value: 11 },
  { name: "Pacific/Auckland", value: 12 },
  { name: "UTC+13 (Samoa)", value: 13 },
  { name: "UTC+14 (Kiribati)", value: 14 },
]

function formatCompactValue(offset: number) {
  return `${offset >= 0 ? "+" : ""}${offset}`
}

export const TimezoneSelector: React.FC<TimezoneSelectorProps> = React.memo(
  ({ label, value, onChange, id, compact = false, layout = "inline", className, selectClassName }) => {
    // Fully controlled — derive selected timezone from value prop directly.
    // If value doesn't match a named entry, fall back to a generic UTC+X label.
    const selectedEntry = useMemo(
      () => timezones.find((tz) => tz.value === value) ?? { name: `UTC${value >= 0 ? "+" : ""}${value}`, value },
      [value],
    )

    const timezoneOptions = useMemo(
      () => {
        const entries = timezones.find((tz) => tz.value === value)
          ? timezones
          : [...timezones, selectedEntry].sort((a, b) => a.value - b.value)
        return entries.map((tz) => (
          <SelectItem key={tz.value} value={String(tz.value)}>
            {tz.name} (UTC{tz.value >= 0 ? "+" : ""}{tz.value})
          </SelectItem>
        ))
      },
      [value, selectedEntry],
    )

    const handleChange = (val: string) => {
      onChange(Number.parseInt(val, 10))
    }

    if (compact) {
      return (
        <Select value={String(selectedEntry.value)} onValueChange={handleChange}>
          <SelectTrigger id={id} className="w-12 h-10 text-xs flex items-center justify-center px-1">
            <SelectValue>{formatCompactValue(selectedEntry.value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>{timezoneOptions}</SelectContent>
        </Select>
      )
    }

    if (layout === "stacked") {
      return (
        <div className={cn("space-y-2", className)}>
          {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
          <Select value={String(selectedEntry.value)} onValueChange={handleChange}>
            <SelectTrigger id={id} className={cn("w-full", selectClassName)}>
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>{timezoneOptions}</SelectContent>
          </Select>
        </div>
      )
    }

    return (
      <div className={cn("grid grid-cols-4 items-center gap-4", className)}>
        <Label htmlFor={id} className="text-right">
          {label}
        </Label>
        <div className="col-span-3">
          <Select value={String(selectedEntry.value)} onValueChange={handleChange}>
            <SelectTrigger id={id} className={cn("w-full", selectClassName)}>
              <SelectValue placeholder="Select timezone" />
            </SelectTrigger>
            <SelectContent>{timezoneOptions}</SelectContent>
          </Select>
        </div>
      </div>
    )
  },
)

TimezoneSelector.displayName = "TimezoneSelector"
