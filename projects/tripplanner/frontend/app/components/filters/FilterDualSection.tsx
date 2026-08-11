import type { ReactNode } from "react"
import { cn } from "../../lib/utils"
import * as PopoverPrimitive from "@radix-ui/react-popover"

interface DualPanelProps {
  label: string
  selectedCount?: number
  totalCount?: number
  showCountWhenAll: boolean
  showCountWhenNone: boolean
  hideCount?: boolean
  onReset?: () => void
  onClear?: () => void
  children: ReactNode
}

interface FilterDualSectionProps {
  icon: ReactNode
  expanded: boolean
  onToggle: () => void
  shakeKey?: number
  left: DualPanelProps
  right: DualPanelProps
}

function PanelColumn({ label, selectedCount, totalCount, showCountWhenAll, showCountWhenNone, hideCount = false, onReset, onClear, children }: DualPanelProps) {
  const hasCount = selectedCount != null && totalCount != null && totalCount > 0
  const isPartial = hasCount && selectedCount > 0 && selectedCount < totalCount
  const isAll = hasCount && selectedCount === totalCount
  const isNone = hasCount && selectedCount === 0
  const showCount = !hideCount && (isPartial || (isAll && showCountWhenAll) || (isNone && showCountWhenNone))
  const isNonDefault = isPartial

  return (
    <div className="flex-1 min-w-[120px] flex flex-col">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {showCount && (
          <span className="text-xs text-muted-foreground">{selectedCount}/{totalCount}</span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 flex-1">
        {children}
      </div>
      <div className="flex items-center gap-2 mt-2">
        {onClear && (
          <button type="button" onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground self-start">
            Deselect all
          </button>
        )}
        {isNonDefault && onReset && (
          <button type="button" onClick={onReset} className="text-xs text-muted-foreground hover:text-foreground self-start">
            Reset
          </button>
        )}
      </div>
    </div>
  )
}

export function FilterDualSection({
  icon,
  expanded,
  onToggle,
  shakeKey = 0,
  left,
  right,
}: FilterDualSectionProps) {
  const hasDot = (side: DualPanelProps) => {
    const hasCount = side.selectedCount != null && side.totalCount != null && side.totalCount > 0
    if (!hasCount) return false
    return side.selectedCount! > 0 && side.selectedCount! < side.totalCount!
  }
  const hasActiveDot = hasDot(left) || hasDot(right)

  const buttonClass = cn(
    "relative inline-flex items-center justify-center cursor-pointer rounded-md border p-2 transition-colors",
    expanded ? "border-border bg-accent/50" : "border-border/50 hover:border-border",
    shakeKey > 0 && "shake-once"
  )

  const iconClass = cn("shrink-0 transition-opacity", expanded ? "opacity-100" : "opacity-40")

  const dot = hasActiveDot ? (
    <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-primary translate-x-1/3 -translate-y-1/3" />
  ) : null

  return (
    <PopoverPrimitive.Root open={expanded}>
      <PopoverPrimitive.Anchor asChild>
        <button key={shakeKey} type="button" data-filter-trigger onClick={onToggle} className={buttonClass}>
          <span className={iconClass}>{icon}</span>
          {dot}
        </button>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          side="bottom"
          sideOffset={4}
          className="z-[60] w-auto max-w-[90vw] rounded-md border bg-popover p-3 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement
            if (target.closest?.('[data-filter-trigger]')) return
            onToggle()
          }}
          onEscapeKeyDown={() => onToggle()}
        >
          <div className="flex gap-4">
            <PanelColumn {...left} />
            <PanelColumn {...right} />
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
