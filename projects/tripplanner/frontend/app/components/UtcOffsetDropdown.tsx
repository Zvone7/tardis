"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "../lib/utils"
import { Button } from "./ui/button"

interface UtcOffsetDropdownProps {
  value: number
  onChange: (offset: number) => void
  className?: string
  triggerClassName?: string
  popupDirection?: "up" | "down"
}

const UTC_OFFSETS = Array.from({ length: 27 }, (_, i) => i - 12) // -12 to +14

function formatOffset(offset: number): string {
  if (offset === 0) return "UTC"
  const sign = offset >= 0 ? "+" : ""
  return `UTC${sign}${offset}`
}

export function UtcOffsetDropdown({
  value,
  onChange,
  className,
  triggerClassName,
  popupDirection = "down",
}: UtcOffsetDropdownProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const handler = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return
      if (containerRef.current.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", handler)
    return () => document.removeEventListener("pointerdown", handler)
  }, [open])

  return (
    <div className={cn("relative flex flex-col gap-1", className)} ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn("w-full justify-between text-sm", triggerClassName)}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="truncate font-medium">{formatOffset(value)}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open ? (
        <div
          className={cn(
            "absolute z-[120] w-full rounded-md border bg-popover p-0 text-popover-foreground shadow-lg",
            popupDirection === "up" ? "bottom-full mb-1" : "mt-1",
          )}
          data-dialog-interactive
        >
          <div className="max-h-64 overflow-y-auto">
            <div className="py-1">
              {UTC_OFFSETS.map((offset) => {
                const isSelected = offset === value
                return (
                  <button
                    type="button"
                    key={offset}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted",
                      isSelected ? "bg-muted/60" : "",
                    )}
                    onClick={() => {
                      onChange(offset)
                      setOpen(false)
                    }}
                  >
                    <span className="font-medium">{formatOffset(offset)}</span>
                    <Check className={cn("h-4 w-4 text-primary", isSelected ? "opacity-100" : "opacity-0")} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
