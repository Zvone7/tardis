import { useEffect } from "react"
import { Label } from "../ui/label"
import { Input } from "../ui/input"

export interface DateRangeValue {
  start: string
  end: string
}

interface DateRangeFilterProps {
  label?: string
  value: DateRangeValue
  onChange: (next: DateRangeValue) => void
  minDate?: string
  maxDate?: string
}

export function DateRangeFilter({
  label = "Date range",
  value,
  onChange,
  minDate,
  maxDate,
}: DateRangeFilterProps) {
  useEffect(() => {
    if ((!value.start || !value.end) && minDate && maxDate) {
      onChange({ start: minDate, end: maxDate })
    }
  }, [minDate, maxDate, value.start, value.end, onChange])

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Input
            type="date"
            value={value.start}
            min={minDate}
            max={value.end || maxDate}
            onChange={(e) => onChange({ ...value, start: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Input
            type="date"
            value={value.end}
            min={value.start || minDate}
            max={maxDate}
            onChange={(e) => onChange({ ...value, end: e.target.value })}
          />
        </div>
      </div>
    </div>
  )
}
