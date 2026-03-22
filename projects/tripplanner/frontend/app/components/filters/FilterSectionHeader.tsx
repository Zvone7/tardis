import { ChevronRight, X } from "lucide-react"
import { cn } from "../../lib/utils"

interface FilterSectionHeaderProps {
  label: string
  expanded?: boolean
  selectedCount?: number
  totalCount?: number
  showCountWhenAll?: boolean
  showCountWhenNone?: boolean
  onReset?: () => void
}

export function FilterSectionHeader({
  label,
  expanded,
  selectedCount,
  totalCount,
  showCountWhenAll = true,
  showCountWhenNone = true,
  onReset,
}: FilterSectionHeaderProps) {
  const hasCount = selectedCount != null && totalCount != null
  const isPartial = hasCount && selectedCount > 0 && selectedCount < totalCount
  const isAll = hasCount && selectedCount === totalCount
  const isNone = hasCount && selectedCount === 0

  const showCount = isPartial || (isAll && showCountWhenAll) || (isNone && showCountWhenNone)

  return (
    <>
      <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0", expanded && "rotate-90")} />
      <span className="text-sm font-medium whitespace-nowrap">{label}</span>
      {showCount && (
        <>
          <span className="text-xs text-muted-foreground whitespace-nowrap">{selectedCount}/{totalCount}</span>
          {isPartial && onReset && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onReset() }} className="text-muted-foreground hover:text-foreground">
              <X className="h-3 w-3" />
            </button>
          )}
        </>
      )}
    </>
  )
}
