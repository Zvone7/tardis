import { useMemo } from "react"
import { Button } from "../ui/button"
import { XIcon } from "lucide-react"
import type { SegmentType } from "../../types/models"

interface SegmentTypeFilterProps {
  types: SegmentType[]
  value: string[]
  onChange: (next: string[]) => void
}

export function SegmentTypeFilter({
  types,
  value,
  onChange,
}: SegmentTypeFilterProps) {
  const sorted = useMemo(() => types.slice().sort((a, b) => a.name.localeCompare(b.name)), [types])

  const toggle = (id: string) => {
    if (value.includes(id)) onChange(value.filter((v) => v !== id))
    else onChange([...value, id])
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sorted.map((type) => {
        const active = value.includes(type.id.toString())
        return (
          <Button
            key={type.id}
            type="button"
            variant={active ? "default" : "outline"}
            size="sm"
            className="h-8 gap-1.5 px-2.5"
            onClick={() => toggle(type.id.toString())}
          >
            {type.iconSvg ? (
              <span
                className="w-4 h-4 shrink-0"
                dangerouslySetInnerHTML={{ __html: type.iconSvg }}
                suppressHydrationWarning
              />
            ) : null}
            {type.name}
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
