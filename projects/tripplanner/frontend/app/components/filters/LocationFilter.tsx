import type { LocationChip } from "../../services/locationLabel"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"

interface LocationFilterProps {
  locations: LocationChip[]
  value: string[]
  onChange: (next: string[]) => void
}

export function LocationFilter({ locations, value, onChange }: LocationFilterProps) {
  const isVisible = (key: string) => value.length === 0 || value.includes(key)

  const toggle = (key: string) => {
    if (value.length === 0) {
      onChange(locations.map((l) => l.key).filter((k) => k !== key))
    } else if (value.includes(key)) {
      const next = value.filter((k) => k !== key)
      onChange(next.length === 0 ? [] : next)
    } else {
      const next = [...value, key]
      onChange(next.length === locations.length ? [] : next)
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
