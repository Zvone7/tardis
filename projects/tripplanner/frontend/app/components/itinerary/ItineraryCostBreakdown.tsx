"use client"

import { useState } from "react"
import { ChevronDownIcon, ChevronRightIcon, UnlinkIcon } from "lucide-react"
import { cn } from "../../lib/utils"
import type { CostBreakdownEntry } from "../../hooks/useItineraryData"
import type { Currency } from "../../types/models"
import { formatCurrencyAmount } from "../../utils/currency"
import { formatDateCompact } from "../../utils/segmentVisuals"

function CostPieChart({ transport, accommodation, other }: { transport: number; accommodation: number; other: number }) {
  const total = transport + accommodation + other
  const radius = 32
  const circumference = 2 * Math.PI * radius
  const segs = [
    { label: "Transport", value: transport, color: "hsl(var(--chart-1))" },
    { label: "Accommodation", value: accommodation, color: "hsl(var(--chart-2))" },
    { label: "Other", value: other, color: "hsl(var(--chart-3))" },
  ]
  let accumulated = 0
  return (
    <svg width="90" height="90" viewBox="0 0 90 90" className="shrink-0">
      <circle cx="45" cy="45" r={radius} fill="transparent" stroke="hsl(var(--muted))" strokeWidth="14" />
      {total > 0 && segs.map((seg) => {
        if (seg.value <= 0) return null
        const dash = (seg.value / total) * circumference
        const circle = (
          <circle
            key={seg.label}
            cx="45" cy="45" r={radius}
            fill="transparent"
            stroke={seg.color}
            strokeWidth="14"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-accumulated}
            strokeLinecap="butt"
            transform="rotate(-90 45 45)"
          />
        )
        accumulated += dash
        return circle
      })}
    </svg>
  )
}

interface ItineraryCostBreakdownProps {
  costBreakdown: CostBreakdownEntry[]
  totalCost: number
  totalDays: number
  costPerDay: number
  dateRange: { start: string | null; end: string | null }
  displayCurrencyId: number | null
  currencies: Currency[]
  onSegmentClick?: (segmentId: number) => void
  onDisconnectSegment?: (segmentId: number) => void
}

export function ItineraryCostBreakdown({
  costBreakdown,
  totalCost,
  totalDays,
  costPerDay,
  dateRange,
  displayCurrencyId,
  currencies,
  onSegmentClick,
  onDisconnectSegment,
}: ItineraryCostBreakdownProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const fmt = (amount: number) => formatCurrencyAmount(amount, displayCurrencyId, currencies)

  const transport = costBreakdown.find((e) => e.category === "Transport")?.totalCost ?? 0
  const accommodation = costBreakdown.find((e) => e.category === "Accommodation")?.totalCost ?? 0
  const other = costBreakdown.find((e) => e.category === "Other")?.totalCost ?? 0

  const legendEntries = costBreakdown.filter((e) => e.totalCost > 0)

  return (
    <div className="px-4 py-4 space-y-4 border-t border-border">
      {/* Summary header */}
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-semibold">{fmt(totalCost)}</span>
          {totalDays > 0 && (
            <span className="text-xs text-muted-foreground">
              {totalDays} {totalDays === 1 ? "day" : "days"} · {fmt(costPerDay)}/day
            </span>
          )}
        </div>
        {(dateRange.start || dateRange.end) && (
          <div className="text-xs text-muted-foreground">
            {dateRange.start ? formatDateCompact(dateRange.start) : "?"} → {dateRange.end ? formatDateCompact(dateRange.end) : "?"}
          </div>
        )}
      </div>

      {/* Pie chart + legend */}
      {costBreakdown.length > 0 && (
        <div className="flex items-center gap-4">
          <CostPieChart transport={transport} accommodation={accommodation} other={other} />
          <div className="space-y-2 text-xs text-muted-foreground">
            {legendEntries.length === 0 ? (
              <div>No categorized costs yet.</div>
            ) : (
              legendEntries.map((entry) => (
                <div key={entry.category} className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-sm ring-1 ring-black/10 dark:ring-white/40"
                    style={{ backgroundColor: entry.color }}
                  />
                  <span className="text-foreground">{entry.category}</span>
                  <span>({fmt(entry.totalCost)})</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Per-category segment breakdown */}
      <div className="space-y-2">
        {costBreakdown.map((entry) => {
          const isExpanded = expandedCategories.has(entry.category)
          return (
            <div key={entry.category} className="rounded-md border border-border overflow-hidden">
              <button
                type="button"
                className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                onClick={() => toggleCategory(entry.category)}
              >
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: entry.color }} />
                  <span className="font-medium">{entry.category}</span>
                  <span className="text-muted-foreground text-xs">({entry.segments.length})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{fmt(entry.totalCost)}</span>
                  {isExpanded ? <ChevronDownIcon className="h-4 w-4 text-muted-foreground" /> : <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="divide-y divide-border">
                  {entry.segments.map(({ segment: seg, segmentType: st }) => (
                    <div
                      key={seg.id}
                      role={onSegmentClick ? "button" : undefined}
                      tabIndex={onSegmentClick ? 0 : undefined}
                      className={cn(
                        "flex items-start gap-3 px-3 py-2 transition-colors",
                        onSegmentClick ? "hover:bg-muted/50 cursor-pointer" : "cursor-default"
                      )}
                      onClick={onSegmentClick ? () => onSegmentClick(seg.id) : undefined}
                      onKeyDown={onSegmentClick ? (e) => { if (e.key === "Enter" || e.key === " ") onSegmentClick(seg.id) } : undefined}
                    >
                      {/* Icon */}
                      {st?.iconSvg ? (
                        <div
                          className="mt-0.5 h-7 w-7 shrink-0 rounded-full flex items-center justify-center overflow-hidden [&_svg]:w-4 [&_svg]:h-4"
                          style={{ background: st.color ?? "#6b7280" }}
                          dangerouslySetInnerHTML={{ __html: st.iconSvg }}
                        />
                      ) : (
                        <div className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-muted flex items-center justify-center text-[10px]">
                          {st?.shortName?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                      )}
                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{seg.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateCompact(seg.startDateTimeUtc)} → {formatDateCompact(seg.endDateTimeUtc)}
                        </div>
                      </div>
                      {/* Cost */}
                      <div className="text-sm font-medium shrink-0">
                        {formatCurrencyAmount(seg.cost ?? 0, seg.currencyId ?? displayCurrencyId, currencies)}
                      </div>
                      {/* Disconnect */}
                      {onDisconnectSegment && (
                        <button
                          type="button"
                          className="shrink-0 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                          onClick={(e) => { e.stopPropagation(); onDisconnectSegment(seg.id) }}
                          aria-label="Disconnect segment"
                        >
                          <UnlinkIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
