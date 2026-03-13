import { useMemo } from "react"
import { Button } from "../ui/button"
import { XIcon } from "lucide-react"

interface LocationFilterProps {
  locations: string[]
  value: string[]
  onChange: (next: string[]) => void
}

export function LocationFilter({
  locations,
  value,
  onChange,
}: LocationFilterProps) {
  const sorted = useMemo(() => locations.slice().sort((a, b) => a.localeCompare(b)), [locations])

  const toggle = (loc: string) => {
    if (value.includes(loc)) onChange(value.filter((v) => v !== loc))
    else onChange([...value, loc])
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sorted.map((loc) => {
        const active = value.includes(loc)
        return (
          <Button
            key={loc}
            type="button"
            variant={active ? "default" : "outline"}
            size="sm"
            className="h-8 px-2.5"
            onClick={() => toggle(loc)}
          >
            {loc}
          </Button>
        )
      })}
      {value.length > 0 && (
        <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => onChange([])}>
          <XIcon className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}
