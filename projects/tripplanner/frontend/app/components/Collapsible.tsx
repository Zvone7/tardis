import type { ReactNode } from "react"
import { ChevronDown } from "lucide-react"

export function Collapsible({
  title,
  open,
  onToggle,
  children,
}: {
  title: ReactNode
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="my-3 rounded-lg border bg-muted/30 shadow-sm transition-colors">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-muted/60"
      >
        <span className="flex-1">{title}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid overflow-hidden px-4 pb-4 transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="min-h-0">{children}</div>
      </div>
    </div>
  )
}
