import { useMemo } from "react"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"

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
  const sorted = useMemo(() => locations.slice().sort((a, b) => {
    // Sort by country (after comma) first, then city
    const [cityA, countryA = ""] = a.split(", ")
    const [cityB, countryB = ""] = b.split(", ")
    const countryCompare = countryA.localeCompare(countryB)
    if (countryCompare !== 0) return countryCompare
    return cityA.localeCompare(cityB)
  }), [locations])

  // value empty = all visible. value non-empty = only those visible.
  const isVisible = (loc: string) => value.length === 0 || value.includes(loc)

  const toggle = (loc: string) => {
    if (value.length === 0) {
      // currently showing all — remove this one
      onChange(sorted.filter((v) => v !== loc))
    } else if (value.includes(loc)) {
      const next = value.filter((v) => v !== loc)
      // if removing would leave none, reset to show all
      onChange(next.length === 0 ? [] : next)
    } else {
      const next = [...value, loc]
      // if all are now selected, reset to show all
      onChange(next.length === sorted.length ? [] : next)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map((loc) => {
        const on = isVisible(loc)
        return (
          <Button
            key={loc}
            type="button"
            variant={on ? "default" : "outline"}
            size="sm"
            className={cn("w-full justify-center", !on && "opacity-50")}
            onClick={() => toggle(loc)}
          >
            {loc}
          </Button>
        )
      })}
    </div>
  )
}
