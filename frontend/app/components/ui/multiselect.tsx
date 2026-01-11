import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"

export type OptionType = {
  value: string
  label: React.ReactNode
}

interface MultiSelectProps {
  options: OptionType[]
  selected: string[]
  onChange: (selected: string[]) => void
  placeholder?: string
}

export function MultiSelect({ options, selected, onChange, placeholder = "Select items..." }: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (!containerRef.current) return
      if (containerRef.current.contains(event.target as Node)) return
      setOpen(false)
    }
    document.addEventListener("pointerdown", handlePointerDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
    }
  }, [open])

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value))
    } else {
      onChange([...selected, value])
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between"
        onClick={() => setOpen((prev) => !prev)}
      >
        {selected.length > 0 ? `${selected.length} selected` : placeholder}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open ? (
        <div
          className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
          role="listbox"
          data-dialog-interactive
        >
          <div className="max-h-60 overflow-auto">
            {options.map((option) => (
              <button
                type="button"
                key={option.value}
                className={cn(
                  "flex w-full cursor-pointer items-center rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                  selected.includes(option.value) ? "bg-accent text-accent-foreground" : "bg-transparent",
                )}
                onClick={() => toggleOption(option.value)}
              >
                <Check
                  className={cn("mr-2 h-4 w-4", selected.includes(option.value) ? "opacity-100" : "opacity-0")}
                />
                {option.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
