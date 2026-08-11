"use client"

import { useEffect, useState } from "react"
import { XIcon, PencilIcon } from "lucide-react"
import type { SegmentApi, SegmentType } from "../../types/models"
import { buildSegmentTitleTokens, buildSegmentConfigFromApi, getSegmentNickname } from "../../utils/formatters"
import { TitleTokens } from "../TitleTokens"
import { Button } from "../ui/button"

interface TimelineSegmentCardProps {
  segment: SegmentApi | null
  segmentType: SegmentType | null
  anchorEl: HTMLDivElement | null
  formatSegmentCost: (seg: SegmentApi) => string | null
  selected?: boolean
  optionName?: string
  onToggle?: (segmentId: number) => void
  onClose: () => void
  onNavigateToSegment?: (segmentId: number) => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

const CARD_WIDTH = 240

function computePosition(anchorEl: HTMLDivElement): { left: number; bottom: number } {
  const rect = anchorEl.getBoundingClientRect()
  let left = rect.left + rect.width / 2 - CARD_WIDTH / 2
  left = Math.max(8, Math.min(window.innerWidth - CARD_WIDTH - 8, left))
  const bottom = window.innerHeight - rect.top + 8
  return { left, bottom }
}

export function TimelineSegmentCard({
  segment,
  segmentType,
  anchorEl,
  formatSegmentCost,
  selected = false,
  optionName,
  onToggle,
  onClose,
  onNavigateToSegment,
  onMouseEnter,
  onMouseLeave,
}: TimelineSegmentCardProps) {
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null)

  useEffect(() => {
    if (!anchorEl) {
      setPos(null)
      return
    }
    setPos(computePosition(anchorEl))
  }, [anchorEl])

  if (!segment || !pos) return null

  const costLabel = formatSegmentCost(segment)
  const segmentConfig = buildSegmentConfigFromApi(segment, segmentType ?? undefined)
  const tokens = buildSegmentTitleTokens({ ...segmentConfig, cost: costLabel ?? segmentConfig.cost })
  const nickname = getSegmentNickname(segment.name)

  return (
    <div
      className="fixed z-[100] rounded-lg border bg-popover shadow-lg p-3"
      style={{ left: pos.left, bottom: pos.bottom, width: CARD_WIDTH }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        className="absolute top-2 right-2 p-0.5 rounded hover:bg-muted transition-colors"
        onClick={onClose}
        aria-label="Close"
      >
        <XIcon className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <div className="pr-5 mb-3">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
          <TitleTokens tokens={tokens} size="sm" />
        </div>
        {nickname && <p className="mt-0.5 text-xs text-muted-foreground italic truncate">"{nickname}"</p>}
      </div>

      {(onToggle || onNavigateToSegment) && (
        <div className="flex items-center gap-1.5">
          {onToggle && (
            <Button
              type="button"
              size="sm"
              variant={selected ? "outline" : "default"}
              className="flex-1"
              onClick={() => onToggle(segment.id)}
            >
              {selected
                ? `Remove from ${optionName || "option"}`
                : `Add to ${optionName || "option"}`}
            </Button>
          )}
          {onNavigateToSegment && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => { onNavigateToSegment(segment.id); onClose() }}
              title="Edit segment"
              aria-label="Edit segment"
            >
              <PencilIcon className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
