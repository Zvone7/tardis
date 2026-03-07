import { useMemo } from "react"
import { Label } from "../ui/label"
import { MultiSelect, type OptionType } from "../ui/multiselect"

interface LocationFilterProps {
  label?: string
  locations: string[]
  value: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}

export function LocationFilter({
  label = "Locations",
  locations,
  value,
  onChange,
  placeholder = "Select locations",
}: LocationFilterProps) {
  const options: OptionType[] = useMemo(() => {
    return locations
      .slice()
      .sort((a, b) => a.localeCompare(b))
      .map((loc) => ({ value: loc, label: loc }))
  }, [locations])

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <MultiSelect options={options} selected={value} onChange={onChange} placeholder={placeholder} />
    </div>
  )
}
