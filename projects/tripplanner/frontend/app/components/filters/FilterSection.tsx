import type { ReactNode } from "react"
import { cn } from "../../lib/utils"
import * as PopoverPrimitive from "@radix-ui/react-popover"

interface FilterSectionProps {
  label: string
  icon: ReactNode
  expanded?: boolean
  onToggle?: () => void
  selectedCount?: number
  totalCount?: number
  showCountWhenAll: boolean
  showCountWhenNone: boolean
  /** When true, "all selected" is the default state (no dot). Partial or none shows dot. */
  selectAllByDefault?: boolean
  /** When true, "none selected" is the default state (no dot). Partial or all shows dot. */
  selectNoneByDefault?: boolean
  onReset?: () => void
  children?: ReactNode
  toggle?: boolean
  active?: boolean
  shakeKey?: number
}

export function FilterSection({
  label,
  icon,
  expanded = false,
  onToggle,
  selectedCount,
  totalCount,
  showCountWhenAll,
  showCountWhenNone,
  selectAllByDefault = false,
  selectNoneByDefault = false,
  onReset,
  children,
  toggle = false,
  active = false,
  shakeKey = 0,
}: FilterSectionProps) {
  const hasCount = selectedCount != null && totalCount != null && totalCount > 0
  const isPartial = hasCount && selectedCount > 0 && selectedCount < totalCount
  const isAll = hasCount && selectedCount === totalCount
  const isNone = hasCount && selectedCount === 0
  const showCount = isPartial || (isAll && showCountWhenAll) || (isNone && showCountWhenNone)

  const hasActiveDot = active || (hasCount && (
    selectAllByDefault ? (isPartial || isNone) :
    selectNoneByDefault ? (isPartial || isAll) :
    isPartial
  ))

  const isNonDefault = hasActiveDot

  const buttonClass = cn(
    "relative inline-flex items-center justify-center cursor-pointer rounded-md border p-2 transition-colors",
    (expanded || active) ? "border-border bg-accent/50" : "border-border/50 hover:border-border",
    shakeKey > 0 && "shake-once"
  )

  const dot = hasActiveDot ? (
    <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-primary translate-x-1/3 -translate-y-1/3" />
  ) : null

  const iconClass = cn("shrink-0 transition-opacity", (expanded || active) ? "opacity-100" : "opacity-40")

  if (toggle || !children) {
    return (
      <button key={shakeKey} type="button" onClick={onToggle} className={buttonClass}>
        <span className={iconClass}>{icon}</span>
        {dot}
      </button>
    )
  }

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
            onToggle?.()
          }}
          onEscapeKeyDown={() => onToggle?.()}
        >
          <div className="flex items-center justify-between gap-4 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
              {showCount && (
                <span className="text-xs text-muted-foreground">{selectedCount}/{totalCount}</span>
              )}
            </div>
            {isNonDefault && onReset && (
              <button
                type="button"
                onClick={onReset}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Reset
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {children}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
