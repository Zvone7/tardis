"use client"

import React, { useState, useCallback, useMemo } from "react"
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
  { name: "America/Los_Angeles", value: -8 },
  { name: "America/Denver", value: -7 },
  { name: "America/Chicago", value: -6 },
  { name: "America/New_York", value: -5 },
  { name: "Europe/London", value: 0 },
  { name: "Europe/Paris/Berlin", value: 1 },
  { name: "Europe/Moscow", value: 3 },
  { name: "Asia/Dubai", value: 4 },
  { name: "Asia/Kolkata", value: 5 },
  { name: "Asia/Shanghai", value: 8 },
  { name: "Asia/Tokyo", value: 9 },
  { name: "Australia/Sydney", value: 11 },
]

export const TimezoneSelector: React.FC<TimezoneSelectorProps> = React.memo(
  ({ label, value, onChange, id, compact = false, layout = "inline", className, selectClassName }) => {
    const [selectedTimezone, setSelectedTimezone] = useState(
      () => timezones.find((tz) => tz.value === value) || timezones[0],
    )

    const handleTimezoneChange = useCallback(
      (newTimezone: string) => {
        const timezone = timezones.find((tz) => tz.name === newTimezone) || timezones[0]
        setSelectedTimezone(timezone)
        onChange(timezone.value)
      },
      [onChange],
    )

    const timezoneOptions = useMemo(
      () =>
        timezones.map((tz) => (
          <SelectItem key={tz.name} value={tz.name}>
            {tz.name} (UTC{tz.value >= 0 ? "+" : ""}
            {tz.value})
          </SelectItem>
        )),
      [],
    )

    const formatCompactValue = (offset: number) => {
      return `${offset >= 0 ? "+" : ""}${offset}`
    }

    if (compact) {
      return (
        <Select value={selectedTimezone.name} onValueChange={handleTimezoneChange}>
          <SelectTrigger id={id} className="w-12 h-10 text-xs flex items-center justify-center px-1">
            <SelectValue>{formatCompactValue(selectedTimezone.value)}</SelectValue>
          </SelectTrigger>
          <SelectContent>{timezoneOptions}</SelectContent>
        </Select>
      )
    }

    if (layout === "stacked") {
      return (
        <div className={cn("space-y-2", className)}>
          {label ? <p className="text-sm text-muted-foreground">{label}</p> : null}
          <Select value={selectedTimezone.name} onValueChange={handleTimezoneChange}>
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
          <Select value={selectedTimezone.name} onValueChange={handleTimezoneChange}>
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
