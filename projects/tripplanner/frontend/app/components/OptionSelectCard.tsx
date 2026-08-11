"use client"

import { Checkbox } from "./ui/checkbox"
import { TitleTokens } from "./TitleTokens"
import { EyeOffIcon } from "lucide-react"
import { cn } from "../lib/utils"
import type { TitleToken } from "../utils/formatters"

interface OptionSelectCardProps {
  optionId: number
  checked: boolean
  onCheckedChange: (checked: boolean | "indeterminate") => void
  tokens: TitleToken[]
  summaryLabel: string
  costLabel?: string | null
  dimmed?: boolean
}

export function OptionSelectCard({
  optionId,
  checked,
  onCheckedChange,
  tokens,
  summaryLabel,
  costLabel,
  dimmed,
}: OptionSelectCardProps) {
  return (
    <label
      htmlFor={`option-${optionId}`}
      className={cn(
        "flex items-start gap-3 rounded-md p-2 hover:bg-muted/60 cursor-pointer",
        dimmed && "bg-muted text-muted-foreground",
      )}
    >
      <Checkbox
        id={`option-${optionId}`}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="mt-1"
        aria-label={`Select ${summaryLabel}`}
      />

      <div className="flex-1 min-w-0" aria-label={summaryLabel}>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
          <TitleTokens tokens={tokens} size="sm" />
        </div>
        {costLabel ? (
          <div className="mt-0.5 text-xs text-muted-foreground">{costLabel}</div>
        ) : null}
      </div>
      {dimmed && <EyeOffIcon className="mt-1 h-4 w-4" aria-hidden="true" />}
    </label>
  )
}
