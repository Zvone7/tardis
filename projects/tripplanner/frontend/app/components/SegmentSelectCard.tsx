"use client"

import { useRef } from "react"
import { Checkbox } from "./ui/checkbox"
import { TitleTokens } from "./TitleTokens"
import { EyeOffIcon } from "lucide-react"
import { cn } from "../lib/utils"
import type { TitleToken } from "../utils/formatters"
import type { SegmentType } from "../types/models"
import { segmentColor } from "../utils/segmentVisuals"

interface SegmentSelectCardProps {
  segmentId: number
  checked: boolean
  onCheckedChange: (checked: boolean | "indeterminate") => void
  tokens: TitleToken[]
  summaryLabel: string
  costLabel?: string | null
  dateRangeLabel?: string | null
  dimmed?: boolean
  /** Segment was already saved (pre-existing selection). If false and checked, shows "unsaved" chip. */
  savedSelection?: boolean
  segmentType?: SegmentType | null
  onSegmentIconMouseEnter?: (el: HTMLDivElement) => void
  onSegmentIconMouseLeave?: () => void
  onSegmentIconClick?: (el: HTMLDivElement) => void
}

export function SegmentSelectCard({
  segmentId,
  checked,
  onCheckedChange,
  tokens,
  summaryLabel,
  costLabel,
  dateRangeLabel,
  dimmed,
  savedSelection,
  segmentType,
  onSegmentIconMouseEnter,
  onSegmentIconMouseLeave,
  onSegmentIconClick,
}: SegmentSelectCardProps) {
  const iconRef = useRef<HTMLDivElement>(null)
  const typeColor = segmentType ? segmentColor(segmentType) : undefined
  const isNewlySelected = checked && savedSelection === false

  return (
    <label
      htmlFor={`segment-${segmentId}`}
      className={cn(
        "flex items-start gap-3 rounded-md p-2 hover:bg-muted/60 cursor-pointer",
        dimmed && "bg-muted text-muted-foreground",
        isNewlySelected && "ring-1 ring-orange-400/60 bg-orange-50/40 dark:bg-orange-950/20",
      )}
    >
      {/* Segment type icon — hover/tap shows the segment card */}
      {segmentType && (
        <div
          ref={iconRef}
          role="button"
          tabIndex={0}
          aria-label={`View ${summaryLabel} details`}
          className="mt-0.5 w-6 h-6 rounded-full bg-white dark:bg-zinc-800 border flex items-center justify-center shrink-0 cursor-pointer hover:scale-110 transition-transform"
          style={{ borderColor: typeColor ?? "transparent", borderWidth: 2 }}
          onMouseEnter={() => iconRef.current && onSegmentIconMouseEnter?.(iconRef.current)}
          onMouseLeave={() => onSegmentIconMouseLeave?.()}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (iconRef.current) onSegmentIconClick?.(iconRef.current)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              e.stopPropagation()
              if (iconRef.current) onSegmentIconClick?.(iconRef.current)
            }
          }}
        >
          {segmentType.iconSvg ? (
            <span
              className="w-3.5 h-3.5 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:fill-zinc-700 dark:[&>svg]:fill-zinc-100"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: segmentType.iconSvg }}
              suppressHydrationWarning
            />
          ) : (
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: typeColor }} />
          )}
        </div>
      )}

      <Checkbox
        id={`segment-${segmentId}`}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="mt-1"
        aria-label={`Select ${summaryLabel}`}
      />

      <div className="flex-1 min-w-0" aria-label={summaryLabel}>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
          <TitleTokens tokens={tokens} size="sm" />
          {isNewlySelected && (
            <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/40 px-1.5 py-0.5 text-[9px] font-medium text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-700/50 shrink-0">
              unsaved
            </span>
          )}
        </div>
        {costLabel ? (
          <div className="mt-0.5 text-xs text-muted-foreground">{costLabel}</div>
        ) : null}
        {dateRangeLabel ? (
          <div className="mt-1 text-xs text-muted-foreground leading-snug">{dateRangeLabel}</div>
        ) : null}
      </div>
      {dimmed && <EyeOffIcon className="mt-1 h-4 w-4" aria-hidden="true" />}
    </label>
  )
}
