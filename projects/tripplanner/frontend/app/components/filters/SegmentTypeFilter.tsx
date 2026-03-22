import { useMemo } from "react"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"
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

  const isVisible = (id: string) => value.length === 0 || value.includes(id)

  const toggle = (id: string) => {
    const allIds = sorted.map((t) => t.id.toString())
    if (value.length === 0) {
      onChange(allIds.filter((v) => v !== id))
    } else if (value.includes(id)) {
      const next = value.filter((v) => v !== id)
      onChange(next.length === 0 ? [] : next)
    } else {
      const next = [...value, id]
      onChange(next.length === allIds.length ? [] : next)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {sorted.map((type) => {
        const on = isVisible(type.id.toString())
        return (
          <Button
            key={type.id}
            type="button"
            variant={on ? "default" : "outline"}
            size="sm"
            className={cn("w-full justify-start gap-2", !on && "opacity-50")}
            onClick={() => toggle(type.id.toString())}
          >
            {type.iconSvg ? (
              <span
                className="w-4 h-4 shrink-0"
                dangerouslySetInnerHTML={{ __html: type.iconSvg }}
                suppressHydrationWarning
              />
            ) : (
              <span className="w-4 h-4 shrink-0 flex items-center justify-center text-xs font-medium">
                {type.shortName?.[0] ?? type.name[0]}
              </span>
            )}
            {type.name}
          </Button>
        )
      })}
    </div>
  )
}
