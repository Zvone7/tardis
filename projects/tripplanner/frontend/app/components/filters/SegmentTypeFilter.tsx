import { useMemo } from "react"
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

  // value empty = all visible. value non-empty = only those IDs visible.
  // UI shows each type as "on" when it IS visible.
  const isVisible = (id: string) => value.length === 0 || value.includes(id)

  const toggle = (id: string) => {
    const allIds = sorted.map((t) => t.id.toString())
    if (value.length === 0) {
      // currently showing all — remove this one
      onChange(allIds.filter((v) => v !== id))
    } else if (value.includes(id)) {
      const next = value.filter((v) => v !== id)
      // if removing would leave none, reset to show all
      onChange(next.length === 0 ? [] : next)
    } else {
      const next = [...value, id]
      // if all are now selected, reset to show all
      onChange(next.length === allIds.length ? [] : next)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {sorted.map((type) => {
        const on = isVisible(type.id.toString())
        return (
          <button
            key={type.id}
            type="button"
            onClick={() => toggle(type.id.toString())}
            title={type.name}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full shadow-sm ring-1 transition-opacity",
              on
                ? "bg-secondary/60 text-secondary-foreground ring-black/5 dark:bg-white dark:text-black"
                : "bg-muted text-muted-foreground ring-black/5 opacity-50 dark:bg-muted dark:text-muted-foreground"
            )}
          >
            {type.iconSvg ? (
              <span
                className="w-4 h-4"
                dangerouslySetInnerHTML={{ __html: type.iconSvg }}
                suppressHydrationWarning
              />
            ) : (
              <span className="text-xs font-medium">{type.shortName?.[0] ?? type.name[0]}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
