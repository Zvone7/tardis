import type { LocationChip } from "../../services/locationLabel"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"

interface LocationFilterProps {
  locations: LocationChip[]
  value: string[] | null
  onChange: (next: string[] | null) => void
}

export function LocationFilter({ locations, value, onChange }: LocationFilterProps) {
  // null = all visible; [] = none visible; [key...] = those specific
  const isVisible = (key: string) => value === null || value.includes(key)

  const toggle = (key: string) => {
    if (value === null) {
      // currently showing all — deselect this one
      onChange(locations.map((l) => l.key).filter((k) => k !== key))
    } else if (value.includes(key)) {
      onChange(value.filter((k) => k !== key))
    } else {
      const next = [...value, key]
      // if all are now selected, collapse back to null (default)
      onChange(next.length === locations.length ? null : next)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {locations.map(({ key, label }) => {
        const on = isVisible(key)
        return (
          <Button
            key={key}
            type="button"
            variant={on ? "default" : "outline"}
            size="sm"
            className={cn("w-full justify-center", !on && "opacity-50")}
            onClick={() => toggle(key)}
          >
            {label}
          </Button>
        )
      })}
    </div>
  )
}
