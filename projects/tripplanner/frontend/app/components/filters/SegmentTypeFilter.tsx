import { useMemo } from "react"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"
import type { SegmentType } from "../../types/models"

interface SegmentTypeFilterProps {
  types: SegmentType[]
  value: string[] | null
  onChange: (next: string[] | null) => void
}

export function SegmentTypeFilter({
  types,
  value,
  onChange,
}: SegmentTypeFilterProps) {
  const sorted = useMemo(() => types.slice().sort((a, b) => a.name.localeCompare(b.name)), [types])

  // null = all visible; [] = none visible; [id...] = those specific
  const isVisible = (id: string) => value === null || value.includes(id)

  const toggle = (id: string) => {
    const allIds = sorted.map((t) => t.id.toString())
    if (value === null) {
      // currently showing all — deselect this one
      onChange(allIds.filter((v) => v !== id))
    } else if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      const next = [...value, id]
      // if all are now selected, collapse back to null (default)
      onChange(next.length === allIds.length ? null : next)
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
